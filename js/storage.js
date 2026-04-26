var App = window.App || {};

App.Storage = (function () {

    // --- Settings (stay in localStorage - per device) ---

    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem('krt_settings')) || { language: 'he' };
        } catch (e) {
            return { language: 'he' };
        }
    }

    function saveSettings(settings) {
        localStorage.setItem('krt_settings', JSON.stringify(settings));
    }

    // --- Exams (Firestore) ---

    async function getExamIndex() {
        var userId = App.Auth.getUserId();
        if (!userId) return [];
        try {
            var snapshot = await App.db.collection('exams')
                .where('trainerIds', 'array-contains', userId)
                .get();
            // Query actual examinee count from subcollections (the examineeCount field
            // on the exam doc is unreliable — unauthenticated self-registrants cannot update it)
            var exams = await Promise.all(snapshot.docs.map(async function (doc) {
                var d = doc.data();
                var countSnap = await App.db.collection('exams').doc(doc.id)
                    .collection('examinees').get();
                return {
                    id: doc.id,
                    name: d.name,
                    date: d.date,
                    createdAt: d.createdAt,
                    examineeCount: countSnap.size,
                    ownerId: d.ownerId
                };
            }));
            // Sort client-side (avoids needing composite index)
            exams.sort(function (a, b) {
                var ta = a.createdAt ? a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime() : 0;
                var tb = b.createdAt ? b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            });
            return exams;
        } catch (err) {
            console.error('getExamIndex error:', err);
            return [];
        }
    }

    async function getExam(examId) {
        var doc = await App.db.collection('exams').doc(examId).get();
        if (!doc.exists) return null;
        var exam = doc.data();
        exam.id = doc.id;

        // Load examinees subcollection
        var examineesSnap = await App.db.collection('exams').doc(examId)
            .collection('examinees').orderBy('order').get();
        exam.examinees = {};
        examineesSnap.docs.forEach(function (d) {
            exam.examinees[d.id] = Object.assign({ id: d.id }, d.data());
        });

        // Load grades subcollection
        var gradesSnap = await App.db.collection('exams').doc(examId)
            .collection('grades').get();
        exam.allGrades = {};
        gradesSnap.docs.forEach(function (d) {
            // Doc ID format: examineeId__trainerId
            var parts = d.id.split('__');
            var examineeId = parts[0];
            var trainerId = parts[1];
            if (!exam.allGrades[examineeId]) exam.allGrades[examineeId] = {};
            exam.allGrades[examineeId][trainerId] = Object.assign({ trainerId: trainerId }, d.data());
        });

        return exam;
    }

    async function createExam(name, date) {
        var userId = App.Auth.getUserId();
        var userName = App.Auth.getUserName();
        var docRef = await App.db.collection('exams').add({
            name: name,
            date: date,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ownerId: userId,
            trainerIds: [userId],
            trainerNames: {},
            invitationCode: '',
            examineeCount: 0
        });
        // Store trainer name mapping
        var nameUpdate = {};
        nameUpdate['trainerNames.' + userId] = userName;
        await docRef.update(nameUpdate);
        return { id: docRef.id, name: name, date: date };
    }

    async function deleteExam(examId) {
        var examRef = App.db.collection('exams').doc(examId);
        var snaps = await Promise.all([
            examRef.collection('examinees').get(),
            examRef.collection('grades').get(),
            examRef.collection('generalRemarks').get()
        ]);
        var allDocs = [];
        snaps.forEach(function (snap) { snap.docs.forEach(function (d) { allDocs.push(d.ref); }); });

        // Firestore batch limit is 500 — chunk accordingly
        for (var i = 0; i < allDocs.length; i += 500) {
            var batch = App.db.batch();
            allDocs.slice(i, i + 500).forEach(function (ref) { batch.delete(ref); });
            await batch.commit();
        }
        await examRef.delete();
    }

    // Snapshot the exam doc + all subcollections so an undo can fully restore it.
    async function captureExamForRestore(examId) {
        var examRef = App.db.collection('exams').doc(examId);
        var results = await Promise.all([
            examRef.get(),
            examRef.collection('examinees').get(),
            examRef.collection('grades').get(),
            examRef.collection('generalRemarks').get()
        ]);
        function pack(snap) {
            return snap.docs.map(function (d) { return { id: d.id, data: d.data() }; });
        }
        var snapshot = {
            examId: examId,
            examData: results[0].exists ? results[0].data() : null,
            examinees: pack(results[1]),
            grades: pack(results[2]),
            generalRemarks: pack(results[3])
        };
        console.log('[captureExamForRestore] captured:', snapshot.examinees.length, 'examinees,', snapshot.grades.length, 'grades,', snapshot.generalRemarks.length, 'remarks');
        return snapshot;
    }

    async function restoreExamFromSnapshot(snapshot) {
        if (!snapshot || !snapshot.examData) return;
        var examRef = App.db.collection('exams').doc(snapshot.examId);
        await examRef.set(snapshot.examData);

        async function writeAll(collName, docs) {
            for (var i = 0; i < docs.length; i += 500) {
                var batch = App.db.batch();
                docs.slice(i, i + 500).forEach(function (entry) {
                    batch.set(examRef.collection(collName).doc(entry.id), entry.data);
                });
                await batch.commit();
            }
        }
        console.log('[restoreExamFromSnapshot] restoring:', snapshot.examinees.length, 'examinees,', snapshot.grades.length, 'grades,', snapshot.generalRemarks.length, 'remarks');
        await writeAll('examinees', snapshot.examinees);
        await writeAll('grades', snapshot.grades);
        await writeAll('generalRemarks', snapshot.generalRemarks);
        console.log('[restoreExamFromSnapshot] done');
    }

    // Restores a previously deleted examinee document with its original ID.
    // Grades subcollection docs survive deletion so they come back automatically.
    async function restoreExaminee(examId, examineeId, data) {
        var payload = Object.assign({}, data);
        delete payload.id;
        await App.db.collection('exams').doc(examId)
            .collection('examinees').doc(examineeId).set(payload);
    }

    // --- General exam remarks (per trainer, in dedicated subcollection) ---
    // Path: exams/{examId}/generalRemarks/{trainerId}

    async function saveGeneralRemarks(examId, text) {
        var trainerId = App.Auth.getUserId();
        var trainerName = App.Auth.getUserName();
        var docRef = App.db.collection('exams').doc(examId)
            .collection('generalRemarks').doc(trainerId);
        await docRef.set({
            trainerId: trainerId,
            trainerName: trainerName,
            text: text,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    // Returns {[trainerId]: {name, text}} for all trainers who wrote remarks.
    async function getGeneralRemarks(examId) {
        var snap = await App.db.collection('exams').doc(examId)
            .collection('generalRemarks').get();
        var result = {};
        snap.docs.forEach(function (d) {
            var data = d.data();
            result[d.id] = { name: data.trainerName || d.id, text: data.text || '' };
        });
        return result;
    }

    // --- Category presets (global Firestore collection) ---

    async function savePreset(name, categoryOrder, customCategories) {
        var userId = App.Auth.getUserId();
        var userName = App.Auth.getUserName();
        await App.db.collection('categoryPresets').add({
            name: name,
            categoryOrder: categoryOrder,
            customCategories: customCategories || {},
            createdBy: userId,
            createdByName: userName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function getPresets() {
        var snap = await App.db.collection('categoryPresets')
            .orderBy('createdAt', 'desc').get();
        return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    }

    async function deletePreset(presetId) {
        await App.db.collection('categoryPresets').doc(presetId).delete();
    }

    async function addExaminee(examId, firstName, lastName, rank) {
        var examRef = App.db.collection('exams').doc(examId);
        var examineeRef = examRef.collection('examinees').doc();
        var examDoc = await examRef.get();
        var currentCount = (examDoc.data().examineeCount || 0);

        await examineeRef.set({
            firstName: firstName,
            lastName: lastName,
            dateOfBirth: '',
            rank: rank || '',
            targetRank: '',
            club: '',
            trainingStartDate: '',
            lastExamDate: '',
            trainingsPerWeek: '',
            beltTrainings: [],
            gasshukus: [],
            examPayment: '',
            photoUrl: '',
            order: currentCount,
            addedBy: 'trainer:' + App.Auth.getUserId(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await examRef.update({
            examineeCount: firebase.firestore.FieldValue.increment(1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return examineeRef.id;
    }

    async function removeExaminee(examId, examineeId) {
        // Delete examinee doc
        await App.db.collection('exams').doc(examId)
            .collection('examinees').doc(examineeId).delete();

        // Delete all grade docs for this examinee
        var gradesSnap = await App.db.collection('exams').doc(examId)
            .collection('grades')
            .where(firebase.firestore.FieldPath.documentId(), '>=', examineeId + '__')
            .where(firebase.firestore.FieldPath.documentId(), '<=', examineeId + '__\uf8ff')
            .get();
        var batch = App.db.batch();
        gradesSnap.docs.forEach(function (d) { batch.delete(d.ref); });
        await batch.commit();

        await App.db.collection('exams').doc(examId).update({
            examineeCount: firebase.firestore.FieldValue.increment(-1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function updateExaminee(examId, examineeId, data) {
        // Remove undefined fields
        var cleanData = {};
        Object.keys(data).forEach(function (k) {
            if (data[k] !== undefined) cleanData[k] = data[k];
        });
        await App.db.collection('exams').doc(examId)
            .collection('examinees').doc(examineeId).update(cleanData);
    }

    async function updateGrade(examId, examineeId, categoryKey, value) {
        var trainerId = App.Auth.getUserId();
        var trainerName = App.Auth.getUserName();
        var gradeDocId = examineeId + '__' + trainerId;
        var gradeRef = App.db.collection('exams').doc(examId)
            .collection('grades').doc(gradeDocId);

        var updateData = {
            trainerId: trainerId,
            trainerName: trainerName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        updateData[categoryKey] = value;

        await gradeRef.set(updateData, { merge: true });
    }

    // --- Real-time listeners ---

    function subscribeToGrades(examId, callback) {
        return App.db.collection('exams').doc(examId)
            .collection('grades')
            .onSnapshot(function (snapshot) {
                var allGrades = {};
                snapshot.docs.forEach(function (d) {
                    var parts = d.id.split('__');
                    var examineeId = parts[0];
                    var trainerId = parts[1];
                    if (!allGrades[examineeId]) allGrades[examineeId] = {};
                    allGrades[examineeId][trainerId] = Object.assign({ trainerId: trainerId }, d.data());
                });
                callback(allGrades);
            });
    }

    function subscribeToExaminees(examId, callback) {
        return App.db.collection('exams').doc(examId)
            .collection('examinees').orderBy('order')
            .onSnapshot(function (snapshot) {
                var examinees = {};
                snapshot.docs.forEach(function (d) {
                    examinees[d.id] = Object.assign({ id: d.id }, d.data());
                });
                callback(examinees);
            });
    }

    // --- Trainer management ---

    async function addTrainerByEmail(examId, email) {
        try {
            var usersSnap = await App.db.collection('users')
                .where('email', '==', email).limit(1).get();
            if (usersSnap.empty) return { error: 'not_found' };

            var trainerDoc = usersSnap.docs[0];
            var trainerId = trainerDoc.id;
            var trainerName = trainerDoc.data().displayName || email;

            var updateData = {
                trainerIds: firebase.firestore.FieldValue.arrayUnion(trainerId),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            updateData['trainerNames.' + trainerId] = trainerName;

            await App.db.collection('exams').doc(examId).update(updateData);
            return { success: true, trainerId: trainerId, trainerName: trainerName };
        } catch (err) {
            console.error('addTrainerByEmail error:', err);
            return { error: 'permission_denied' };
        }
    }

    async function addTrainerById(examId, trainerId, trainerName) {
        var updateData = {
            trainerIds: firebase.firestore.FieldValue.arrayUnion(trainerId),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        updateData['trainerNames.' + trainerId] = trainerName;
        await App.db.collection('exams').doc(examId).update(updateData);
        return { success: true, trainerId: trainerId, trainerName: trainerName };
    }

    async function getKnownTrainers() {
        var userId = App.Auth.getUserId();
        try {
            var snapshot = await App.db.collection('exams')
                .where('trainerIds', 'array-contains', userId)
                .get();
            var trainers = {};
            snapshot.docs.forEach(function (doc) {
                var data = doc.data();
                var names = data.trainerNames || {};
                (data.trainerIds || []).forEach(function (tid) {
                    if (tid !== userId && !trainers[tid]) {
                        trainers[tid] = names[tid] || tid.slice(0, 8);
                    }
                });
            });
            return trainers;
        } catch (err) {
            console.error('getKnownTrainers error:', err);
            return {};
        }
    }

    // --- Invitation ---

    async function generateInvitationCode(examId) {
        var code = Math.random().toString(36).substring(2, 8).toUpperCase();
        var examRef = App.db.collection('exams').doc(examId);
        var examDoc = await examRef.get();
        var exam = examDoc.data();
        await examRef.update({ invitationCode: code });
        // Write public invitation doc — contains only code/name/date, not the full exam
        await App.db.collection('examInvitations').doc(examId).set({
            code: code,
            name: exam.name || '',
            date: exam.date || ''
        });
        return code;
    }

    // Syncs the public examInvitations doc — called when trainer opens the invite modal
    // to ensure backward-compatible exams (created before examInvitations existed) still work
    async function syncInvitationDoc(examId, code, name, date) {
        await App.db.collection('examInvitations').doc(examId).set({
            code: code,
            name: name || '',
            date: date || ''
        });
    }

    async function verifyInvitationCode(examId, code) {
        // Read from the public examInvitations collection — never from the full exam doc
        var doc = await App.db.collection('examInvitations').doc(examId).get();
        if (!doc.exists) return null;
        var inv = doc.data();
        if (inv.code && inv.code === code.toUpperCase()) {
            return { id: examId, name: inv.name, date: inv.date };
        }
        return null;
    }

    async function selfRegisterExaminee(examId, data, invitationCode) {
        var examRef = App.db.collection('exams').doc(examId);
        var examineeRef = examRef.collection('examinees').doc();

        // Generate a random token the student will use to come back and edit their own registration
        var selfEditToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

        await examineeRef.set({
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: data.dateOfBirth || '',
            rank: data.rank || '',
            targetRank: data.targetRank || '',
            club: data.club || '',
            trainingStartDate: data.trainingStartDate || '',
            lastExamDate: data.lastExamDate || '',
            trainingsPerWeek: data.trainingsPerWeek || '',
            beltTrainings: Array.isArray(data.beltTrainings) ? data.beltTrainings : [],
            gasshukus: Array.isArray(data.gasshukus) ? data.gasshukus : [],
            examPayment: data.examPayment || '',
            photoUrl: data.photoUrl || '',
            order: 0,
            addedBy: 'self-registration',
            invitationCode: invitationCode,
            selfEditToken: selfEditToken,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        try {
            await examRef.update({
                examineeCount: firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            // May fail for unauthenticated registrants — count is cosmetic
            console.warn('Could not update exam count:', e);
        }

        return { id: examineeRef.id, selfEditToken: selfEditToken };
    }

    // Returns examinee data IFF the token matches. Used for student self-edit flow.
    async function getSelfRegistration(examId, examineeId, token) {
        var doc = await App.db.collection('exams').doc(examId)
            .collection('examinees').doc(examineeId).get();
        if (!doc.exists) return null;
        var data = doc.data();
        if (!data.selfEditToken || data.selfEditToken !== token) return null;
        return Object.assign({ id: doc.id }, data);
    }

    // Updates only personal fields (no grades, no order, no payment/form/theory).
    // Sends the unchanged selfEditToken so the Firestore rule can verify identity.
    async function selfUpdateRegistration(examId, examineeId, token, data) {
        var docRef = App.db.collection('exams').doc(examId)
            .collection('examinees').doc(examineeId);
        var snap = await docRef.get();
        if (!snap.exists) throw new Error('not_found');
        if (snap.data().selfEditToken !== token) throw new Error('invalid_token');

        var allowed = [
            'firstName', 'lastName', 'dateOfBirth', 'rank', 'club',
            'trainingStartDate', 'lastExamDate', 'trainingsPerWeek',
            'beltTrainings', 'gasshukus', 'photoUrl'
        ];
        var update = { selfEditToken: token };
        allowed.forEach(function (k) {
            if (data[k] !== undefined) update[k] = data[k];
        });
        update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await docRef.update(update);
    }

    // --- Copy Examinees ---

    async function copyExaminees(sourceExamId, targetExamId, examineeIds) {
        var targetRef = App.db.collection('exams').doc(targetExamId);
        var targetDoc = await targetRef.get();
        var currentCount = (targetDoc.data().examineeCount || 0);

        var batch = App.db.batch();
        var addedCount = 0;

        for (var i = 0; i < examineeIds.length; i++) {
            var sourceDoc = await App.db.collection('exams').doc(sourceExamId)
                .collection('examinees').doc(examineeIds[i]).get();
            if (!sourceDoc.exists) continue;
            var ex = sourceDoc.data();
            var newRef = targetRef.collection('examinees').doc();
            batch.set(newRef, {
                firstName: ex.firstName || '',
                lastName: ex.lastName || '',
                dateOfBirth: ex.dateOfBirth || '',
                rank: ex.rank || '',
                targetRank: ex.targetRank || '',
                club: ex.club || '',
                trainingStartDate: ex.trainingStartDate || '',
                lastExamDate: ex.lastExamDate || '',
                trainingsPerWeek: ex.trainingsPerWeek || '',
                beltTrainings: ex.beltTrainings || '',
                gasshukus: Array.isArray(ex.gasshukus) ? ex.gasshukus : [],
                examPayment: ex.examPayment || '',
                photoUrl: ex.photoUrl || '',
                order: currentCount + addedCount,
                addedBy: 'copied:' + sourceExamId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            addedCount++;
        }

        if (addedCount > 0) {
            await batch.commit();
            await targetRef.update({
                examineeCount: firebase.firestore.FieldValue.increment(addedCount),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        return addedCount;
    }

    // --- Category Management ---

    async function updateCategoryOrder(examId, order) {
        await App.db.collection('exams').doc(examId).update({
            categoryOrder: order,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function updateCustomCategories(examId, customCategories) {
        await App.db.collection('exams').doc(examId).update({
            customCategories: customCategories,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // --- Export/Import ---

    async function exportExam(examId) {
        var exam = await getExam(examId);
        if (!exam) return;
        var json = JSON.stringify(exam, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (exam.name || 'exam') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function importExam(file, callback) {
        var reader = new FileReader();
        reader.onload = async function (e) {
            try {
                var data = JSON.parse(e.target.result);
                var userId = App.Auth.getUserId();
                var userName = App.Auth.getUserName();

                // Create exam doc
                var examData = {
                    name: data.name || 'Imported Exam',
                    date: data.date || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    ownerId: userId,
                    trainerIds: [userId],
                    trainerNames: {},
                    invitationCode: '',
                    examineeCount: 0
                };
                examData.trainerNames[userId] = userName;

                var examRef = await App.db.collection('exams').add(examData);

                // Import examinees
                if (data.examinees) {
                    var examinees = typeof data.examinees === 'object' ? Object.values(data.examinees) : [];
                    for (var i = 0; i < examinees.length; i++) {
                        var ex = examinees[i];
                        var exRef = examRef.collection('examinees').doc();
                        await exRef.set({
                            firstName: ex.firstName || '',
                            lastName: ex.lastName || '',
                            dateOfBirth: ex.dateOfBirth || '',
                            rank: ex.rank || '',
                            club: ex.club || '',
                            trainingStartDate: ex.trainingStartDate || '',
                            lastExamDate: ex.lastExamDate || '',
                            trainingsPerWeek: ex.trainingsPerWeek || '',
                            photoUrl: ex.photoUrl || ex.photo || '',
                            order: i,
                            addedBy: 'import',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        // Import grades for this examinee (old format: grades[oldId])
                        var oldId = ex.id || Object.keys(data.examinees)[i];
                        if (data.grades && data.grades[oldId]) {
                            var gradeDocId = exRef.id + '__' + userId;
                            var gradeData = Object.assign({}, data.grades[oldId], {
                                trainerId: userId,
                                trainerName: userName,
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            await examRef.collection('grades').doc(gradeDocId).set(gradeData);
                        }
                        // New format: allGrades
                        if (data.allGrades && data.allGrades[oldId]) {
                            var trainers = Object.keys(data.allGrades[oldId]);
                            for (var j = 0; j < trainers.length; j++) {
                                var tid = trainers[j];
                                var gDocId = exRef.id + '__' + tid;
                                await examRef.collection('grades').doc(gDocId).set(data.allGrades[oldId][tid]);
                            }
                        }
                    }
                    await examRef.update({ examineeCount: examinees.length });
                }

                if (callback) callback(null);
            } catch (err) {
                if (callback) callback(err);
            }
        };
        reader.readAsText(file);
    }

    // --- Excel / CSV (students only) ---

    // Columns used for both export and import. Keep in sync with the registration form.
    var STUDENT_COLUMNS = [
        'firstName', 'lastName', 'dateOfBirth', 'rank', 'club',
        'trainingStartDate', 'lastExamDate', 'trainingsPerWeek',
        'beltTrainings', 'gasshukuCount', 'examPayment',
        'formSubmitted', 'theoryExamGrade'
    ];

    function buildStudentRows(exam) {
        var header = STUDENT_COLUMNS.map(function (k) { return App.I18n.t(k); });
        var rows = [header];
        var examinees = Object.values(exam.examinees || {}).sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });
        examinees.forEach(function (ex) {
            rows.push(STUDENT_COLUMNS.map(function (k) {
                var v = ex[k];
                if (v == null) return '';
                if (Array.isArray(v)) return String(v.length);
                return String(v);
            }));
        });
        return rows;
    }

    async function exportExamineesToExcel(examId) {
        if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded');
        var exam = await getExam(examId);
        if (!exam) return;
        var rows = buildStudentRows(exam);
        var ws = XLSX.utils.aoa_to_sheet(rows);
        // Right-to-left for Hebrew
        ws['!rtl'] = true;
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Examinees');
        XLSX.writeFile(wb, (exam.name || 'exam') + '-נבחנים.xlsx');
    }

    async function exportExamineesToCsv(examId) {
        var exam = await getExam(examId);
        if (!exam) return;
        var rows = buildStudentRows(exam);
        // Quote fields containing comma, quote, or newline; escape quotes by doubling.
        var csv = rows.map(function (row) {
            return row.map(function (val) {
                var s = String(val == null ? '' : val);
                if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
                return s;
            }).join(',');
        }).join('\r\n');
        // UTF-8 BOM so Excel/Sheets render Hebrew correctly
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (exam.name || 'exam') + '-נבחנים.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Simple CSV parser — handles quoted fields with embedded commas/newlines/quotes.
    function parseCsv(text) {
        // Strip BOM
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else { inQuotes = false; }
                } else {
                    field += ch;
                }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { row.push(field); field = ''; }
                else if (ch === '\r') { /* ignore */ }
                else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
                else { field += ch; }
            }
        }
        // Flush final field/row
        if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
        return rows;
    }

    // Imports examinees from .xlsx or .csv into the given exam.
    // Expects first row to be headers matching either English keys (STUDENT_COLUMNS)
    // or translated labels (via i18n). Unknown columns are ignored.
    async function importExamineesFromFile(examId, file) {
        var name = file.name.toLowerCase();
        var rows;

        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded');
            var buf = await file.arrayBuffer();
            var wb = XLSX.read(buf, { type: 'array' });
            var ws = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        } else if (name.endsWith('.csv')) {
            var text = await file.text();
            rows = parseCsv(text);
        } else {
            throw new Error('unsupported_format');
        }

        // Drop trailing empty rows
        while (rows.length && rows[rows.length - 1].every(function (v) { return v === '' || v == null; })) {
            rows.pop();
        }
        if (rows.length < 2) throw new Error('no_data');

        // Build header → column-key map. Accept either raw English key or localized label.
        var headers = rows[0].map(function (h) { return String(h || '').trim(); });
        var labelToKey = {};
        STUDENT_COLUMNS.forEach(function (k) {
            labelToKey[k] = k;
            labelToKey[App.I18n.t(k)] = k;
        });
        var colKeys = headers.map(function (h) { return labelToKey[h] || null; });
        if (!colKeys.some(function (k) { return k === 'firstName'; })) {
            throw new Error('missing_firstName_column');
        }

        // Fetch current max order so new rows append at the end
        var examRef = App.db.collection('exams').doc(examId);
        var existingSnap = await examRef.collection('examinees').get();
        var maxOrder = -1;
        existingSnap.docs.forEach(function (d) {
            var o = d.data().order;
            if (typeof o === 'number' && o > maxOrder) maxOrder = o;
        });

        var batch = App.db.batch();
        var added = 0;
        for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            // Skip fully empty rows
            if (row.every(function (v) { return v === '' || v == null; })) continue;

            var data = {};
            STUDENT_COLUMNS.forEach(function (k) { data[k] = ''; });
            colKeys.forEach(function (key, idx) {
                if (key) data[key] = row[idx] == null ? '' : String(row[idx]).trim();
            });
            if (!data.firstName) continue;

            var newRef = examRef.collection('examinees').doc();
            batch.set(newRef, Object.assign({}, data, {
                photoUrl: '',
                order: maxOrder + 1 + added,
                addedBy: 'imported',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }));
            added++;
        }

        if (added > 0) {
            await batch.commit();
            try {
                await examRef.update({
                    examineeCount: firebase.firestore.FieldValue.increment(added),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) { /* count cosmetic */ }
        }
        return added;
    }

    // Thin wrapper for top-level exam field updates (e.g. renaming).
    async function updateExam(examId, data) {
        var payload = Object.assign({}, data, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await App.db.collection('exams').doc(examId).update(payload);
    }

    return {
        getSettings: getSettings,
        saveSettings: saveSettings,
        getExamIndex: getExamIndex,
        getExam: getExam,
        createExam: createExam,
        updateExam: updateExam,
        deleteExam: deleteExam,
        captureExamForRestore: captureExamForRestore,
        restoreExamFromSnapshot: restoreExamFromSnapshot,
        restoreExaminee: restoreExaminee,
        saveGeneralRemarks: saveGeneralRemarks,
        getGeneralRemarks: getGeneralRemarks,
        savePreset: savePreset,
        getPresets: getPresets,
        deletePreset: deletePreset,
        addExaminee: addExaminee,
        removeExaminee: removeExaminee,
        updateExaminee: updateExaminee,
        updateGrade: updateGrade,
        subscribeToGrades: subscribeToGrades,
        subscribeToExaminees: subscribeToExaminees,
        addTrainerByEmail: addTrainerByEmail,
        generateInvitationCode: generateInvitationCode,
        syncInvitationDoc: syncInvitationDoc,
        verifyInvitationCode: verifyInvitationCode,
        selfRegisterExaminee: selfRegisterExaminee,
        getSelfRegistration: getSelfRegistration,
        selfUpdateRegistration: selfUpdateRegistration,
        exportExam: exportExam,
        importExam: importExam,
        exportExamineesToExcel: exportExamineesToExcel,
        exportExamineesToCsv: exportExamineesToCsv,
        importExamineesFromFile: importExamineesFromFile,
        copyExaminees: copyExaminees,
        updateCategoryOrder: updateCategoryOrder,
        updateCustomCategories: updateCustomCategories,
        addTrainerById: addTrainerById,
        getKnownTrainers: getKnownTrainers
    };
})();
