var App = window.App || {};

// Keeps the public studentDirectory filled without anyone having to remember to.
//
// Returning students identify themselves on the invite page by looking up this
// directory. It used to be filled only by a "Sync" menu action, which in practice
// nobody runs — so a student who had sat an exam before could not be found and
// had to type everything again. Now:
//
//   - opening an exam syncs it, from the data the exam table already loaded;
//   - changing a rank decision re-syncs it shortly after, so a promotion lands;
//   - the exam list quietly backfills every exam once a day per device, which is
//     what repairs students from exams nobody has opened since.
//
// Each exam's synced state is fingerprinted per device, so an unchanged exam
// costs nothing on later visits. A permission error stops everything and is shown
// to the trainer once: it means the studentDirectory Firestore rule is missing,
// which no amount of retrying will fix.

App.DirectorySync = (function () {
    // Bump to force every device to resync, e.g. after a change to how keys are built.
    var FP_VERSION = 'v1';
    var BACKFILL_KEY = 'krt_dirsync_backfill_at';
    var BACKFILL_EVERY_MS = 24 * 60 * 60 * 1000;

    var _running = {};          // examId -> true while a sync is in flight
    var _pending = {};          // examId -> debounce timer
    var _backfilling = false;
    var _warnedPermission = false;

    function _fpKey(examId) { return 'krt_dirsync_' + examId; }

    function _get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function _set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    function _hash(s) {
        var h = 5381;
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36);
    }

    // Covers exactly what ends up in a directory entry: the personal fields and
    // the rank resolved from the exam's result. Anything else changing (notes,
    // marks on other categories) leaves the fingerprint alone and costs no writes.
    function fingerprint(exam) {
        var parts = [FP_VERSION, exam.date || ''];
        var examinees = exam.examinees || {};
        Object.keys(examinees).sort().forEach(function (id) {
            var d = examinees[id] || {};
            var grades = exam.allGrades && exam.allGrades[id] ? Object.values(exam.allGrades[id]) : [];
            var photo = d.photoUrl || '';
            // JSON rather than a joined string: concatenation is ambiguous
            // ("אב"+"ג" and "א"+"בג" collide) and a collision would skip a real change.
            parts.push([
                id, d.firstName || '', d.lastName || '',
                App.Utils.normalizeDate(d.dateOfBirth), d.club || '',
                App.Storage.resolveCurrentRank(grades, d),
                d.trainingStartDate || '', d.trainingsPerWeek || '',
                d.gasshukus || [], d.beltTrainings || [],
                // A base64 photo is large; its length and tail are enough to notice a change.
                photo.length + ':' + photo.slice(-24)
            ]);
        });
        return _hash(JSON.stringify(parts));
    }

    function reportPermissionProblem() {
        if (_warnedPermission) return;
        _warnedPermission = true;
        console.error('studentDirectory: permission denied — the Firestore rule is missing or wrong');
        if (typeof App.showToast === 'function') App.showToast(App.I18n.t('directoryRuleMissing'));
    }

    // Syncs one loaded exam if its content changed since this device last synced
    // it. Resolves to the sync result, or null when skipped. Never throws.
    async function syncExam(exam, opts) {
        opts = opts || {};
        if (!exam || !exam.id || !App.Auth.isLoggedIn()) return null;
        if (_running[exam.id]) return null;

        var fp = fingerprint(exam);
        if (!opts.force && _get(_fpKey(exam.id)) === fp) return null;

        _running[exam.id] = true;
        try {
            var res = await App.Storage.syncStudentDirectoryFromLoadedExam(exam);
            _set(_fpKey(exam.id), fp);
            return res;
        } catch (e) {
            if (e && e.code === 'permission-denied') {
                reportPermissionProblem();
                // Rethrown so a backfill knows to stop; a lone sync just swallows it.
                if (opts.rethrowPermission) throw e;
            } else {
                console.warn('directory sync failed for exam', exam.id, e);
            }
            return null;
        } finally {
            delete _running[exam.id];
        }
    }

    // Debounced re-sync after grading changes. `getExam` is a function returning the
    // exam as it stands at the moment the timer fires, not when it was scheduled.
    function scheduleExam(examId, getExam, delayMs) {
        clearTimeout(_pending[examId]);
        _pending[examId] = setTimeout(function () {
            delete _pending[examId];
            var exam = getExam();
            if (exam) syncExam(exam);
        }, delayMs || 5000);
    }

    // Walks all of this trainer's exams newest first, at most once a day per device.
    // Newest first means the staleness guard rejects older entries for a student
    // already written from a newer exam, so most of the older work is skipped.
    // A permission error aborts and does not record a run, so the backfill retries
    // as soon as the rule has been fixed.
    async function backfill() {
        if (_backfilling || !App.Auth.isLoggedIn()) return;
        var last = parseInt(_get(BACKFILL_KEY) || '0', 10);
        if (last && Date.now() - last < BACKFILL_EVERY_MS) return;

        _backfilling = true;
        try {
            var index = await App.Storage.getExamIndex();
            index.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
            for (var i = 0; i < index.length; i++) {
                var exam = await App.Storage.getExam(index[i].id);
                if (exam) await syncExam(exam, { rethrowPermission: true });
                // Leave room for whatever the trainer is actually doing.
                await new Promise(function (r) { setTimeout(r, 250); });
            }
            _set(BACKFILL_KEY, String(Date.now()));
        } catch (e) {
            if (!(e && e.code === 'permission-denied')) console.warn('directory backfill stopped:', e);
        } finally {
            _backfilling = false;
        }
    }

    return {
        fingerprint: fingerprint,
        syncExam: syncExam,
        scheduleExam: scheduleExam,
        backfill: backfill,
        reportPermissionProblem: reportPermissionProblem
    };
})();
