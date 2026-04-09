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
        var snapshot = await App.db.collection('exams')
            .where('trainerIds', 'array-contains', userId)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(function (doc) {
            var d = doc.data();
            return {
                id: doc.id,
                name: d.name,
                date: d.date,
                createdAt: d.createdAt,
                examineeCount: d.examineeCount || 0,
                ownerId: d.ownerId
            };
        });
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
        // Delete subcollections first
        var examineesSnap = await App.db.collection('exams').doc(examId).collection('examinees').get();
        var gradesSnap = await App.db.collection('exams').doc(examId).collection('grades').get();
        var batch = App.db.batch();
        examineesSnap.docs.forEach(function (d) { batch.delete(d.ref); });
        gradesSnap.docs.forEach(function (d) { batch.delete(d.ref); });
        await batch.commit();
        await App.db.collection('exams').doc(examId).delete();
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
            club: '',
            trainingStartDate: '',
            lastExamDate: '',
            trainingsPerWeek: '',
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
    }

    // --- Invitation ---

    async function generateInvitationCode(examId) {
        var code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await App.db.collection('exams').doc(examId).update({
            invitationCode: code
        });
        return code;
    }

    async function verifyInvitationCode(examId, code) {
        var doc = await App.db.collection('exams').doc(examId).get();
        if (!doc.exists) return null;
        var exam = doc.data();
        if (exam.invitationCode && exam.invitationCode === code.toUpperCase()) {
            return { id: doc.id, name: exam.name, date: exam.date };
        }
        return null;
    }

    async function selfRegisterExaminee(examId, data, invitationCode) {
        var examRef = App.db.collection('exams').doc(examId);
        var examineeRef = examRef.collection('examinees').doc();
        var examDoc = await examRef.get();
        var currentCount = (examDoc.data().examineeCount || 0);

        await examineeRef.set({
            firstName: data.firstName,
            lastName: data.lastName,
            dateOfBirth: data.dateOfBirth || '',
            rank: data.rank || '',
            club: data.club || '',
            trainingStartDate: data.trainingStartDate || '',
            lastExamDate: data.lastExamDate || '',
            trainingsPerWeek: data.trainingsPerWeek || '',
            photoUrl: data.photoUrl || '',
            order: currentCount,
            addedBy: 'self-registration',
            invitationCode: invitationCode,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await examRef.update({
            examineeCount: firebase.firestore.FieldValue.increment(1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return examineeRef.id;
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

    return {
        getSettings: getSettings,
        saveSettings: saveSettings,
        getExamIndex: getExamIndex,
        getExam: getExam,
        createExam: createExam,
        deleteExam: deleteExam,
        addExaminee: addExaminee,
        removeExaminee: removeExaminee,
        updateExaminee: updateExaminee,
        updateGrade: updateGrade,
        subscribeToGrades: subscribeToGrades,
        subscribeToExaminees: subscribeToExaminees,
        addTrainerByEmail: addTrainerByEmail,
        generateInvitationCode: generateInvitationCode,
        verifyInvitationCode: verifyInvitationCode,
        selfRegisterExaminee: selfRegisterExaminee,
        exportExam: exportExam,
        importExam: importExam
    };
})();
