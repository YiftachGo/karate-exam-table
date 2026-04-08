var App = window.App || {};

App.Storage = (function () {
    var PREFIX = 'krt_';
    var INDEX_KEY = PREFIX + 'exam_index';
    var SETTINGS_KEY = PREFIX + 'settings';

    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { language: 'he' };
        } catch (e) {
            return { language: 'he' };
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function getExamIndex() {
        try {
            return JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveExamIndex(index) {
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }

    function getExam(examId) {
        try {
            return JSON.parse(localStorage.getItem(PREFIX + examId));
        } catch (e) {
            return null;
        }
    }

    function saveExam(exam) {
        exam.updatedAt = new Date().toISOString();
        localStorage.setItem(PREFIX + exam.id, JSON.stringify(exam));
        var index = getExamIndex();
        var found = false;
        for (var i = 0; i < index.length; i++) {
            if (index[i].id === exam.id) {
                index[i].name = exam.name;
                index[i].date = exam.date;
                index[i].examineeCount = Object.keys(exam.examinees || {}).length;
                found = true;
                break;
            }
        }
        if (!found) {
            index.push({
                id: exam.id,
                name: exam.name,
                date: exam.date,
                createdAt: exam.createdAt,
                examineeCount: Object.keys(exam.examinees || {}).length
            });
        }
        saveExamIndex(index);
    }

    function deleteExam(examId) {
        localStorage.removeItem(PREFIX + examId);
        var index = getExamIndex().filter(function (e) { return e.id !== examId; });
        saveExamIndex(index);
    }

    function createExam(name, date) {
        var id = App.Utils.generateId('exam');
        var exam = {
            id: id,
            name: name,
            date: date,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            examinees: {},
            grades: {}
        };
        saveExam(exam);
        return exam;
    }

    function addExaminee(examId, firstName, lastName, rank) {
        var exam = getExam(examId);
        if (!exam) return null;
        var examineeId = App.Utils.generateId('examinee');
        var order = Object.keys(exam.examinees).length;
        exam.examinees[examineeId] = {
            id: examineeId,
            firstName: firstName,
            lastName: lastName,
            dateOfBirth: '',
            rank: rank || '',
            club: '',
            trainingStartDate: '',
            lastExamDate: '',
            trainingsPerWeek: '',
            photo: '',
            order: order
        };
        exam.grades[examineeId] = App.Utils.getEmptyGrades();
        saveExam(exam);
        return examineeId;
    }

    function removeExaminee(examId, examineeId) {
        var exam = getExam(examId);
        if (!exam) return;
        delete exam.examinees[examineeId];
        delete exam.grades[examineeId];
        saveExam(exam);
    }

    function updateExaminee(examId, examineeId, data) {
        var exam = getExam(examId);
        if (!exam || !exam.examinees[examineeId]) return;
        Object.assign(exam.examinees[examineeId], data);
        saveExam(exam);
    }

    function updateGrade(examId, examineeId, categoryKey, value) {
        var exam = getExam(examId);
        if (!exam) return;
        if (!exam.grades[examineeId]) {
            exam.grades[examineeId] = App.Utils.getEmptyGrades();
        }
        exam.grades[examineeId][categoryKey] = value;
        saveExam(exam);
    }

    function exportExam(examId) {
        var exam = getExam(examId);
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

    function exportAllExams() {
        var index = getExamIndex();
        var allData = { exams: [] };
        index.forEach(function (entry) {
            var exam = getExam(entry.id);
            if (exam) allData.exams.push(exam);
        });
        var json = JSON.stringify(allData, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'karate_exams_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importExam(file, callback) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.exams && Array.isArray(data.exams)) {
                    data.exams.forEach(function (exam) {
                        exam.id = App.Utils.generateId('exam');
                        saveExam(exam);
                    });
                } else if (data.id && data.examinees !== undefined) {
                    data.id = App.Utils.generateId('exam');
                    saveExam(data);
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
        saveExam: saveExam,
        deleteExam: deleteExam,
        createExam: createExam,
        addExaminee: addExaminee,
        removeExaminee: removeExaminee,
        updateExaminee: updateExaminee,
        updateGrade: updateGrade,
        exportExam: exportExam,
        exportAllExams: exportAllExams,
        importExam: importExam
    };
})();
