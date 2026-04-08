var App = window.App || {};

App.I18n = (function () {
    var strings = {
        he: {
            appTitle: 'טבלת בוחנים',
            newExam: 'מבחן חדש',
            examName: 'שם המבחן',
            examDate: 'תאריך המבחן',
            create: 'צור',
            cancel: 'ביטול',
            delete: 'מחק',
            save: 'שמור',
            back: 'חזרה',
            export: 'ייצוא',
            import: 'ייבוא',
            exportAll: 'ייצוא הכל',
            importExam: 'ייבוא מבחן',
            addExaminee: 'הוסף נבחן',
            removeExaminee: 'הסר נבחן',
            firstName: 'שם פרטי',
            lastName: 'שם משפחה',
            fullName: 'שם מלא',
            dateOfBirth: 'תאריך לידה',
            age: 'גיל',
            rank: 'דרגה',
            club: 'מועדון',
            trainingStartDate: 'תאריך התחלת אימונים',
            lastExamDate: 'תאריך מבחן אחרון',
            trainingsPerWeek: 'מספר אימונים בשבוע',
            photo: 'תמונה',
            uploadPhoto: 'העלה תמונה',
            removePhoto: 'הסר תמונה',
            noExams: 'אין מבחנים עדיין. צור מבחן חדש כדי להתחיל.',
            examinees: 'נבחנים',
            confirmDelete: 'האם אתה בטוח שברצונך למחוק?',
            confirmDeleteExam: 'האם אתה בטוח שברצונך למחוק את המבחן הזה?',
            confirmDeleteExaminee: 'האם אתה בטוח שברצונך להסיר נבחן זה?',
            dataSaved: 'הנתונים נשמרו',
            category: 'קטגוריה',
            enterNotes: 'הכנס הערות...',
            examInfo: 'פרטי מבחן',
            examineeDetails: 'פרטי נבחן'
        },
        en: {
            appTitle: 'Exam Grading Table',
            newExam: 'New Exam',
            examName: 'Exam Name',
            examDate: 'Exam Date',
            create: 'Create',
            cancel: 'Cancel',
            delete: 'Delete',
            save: 'Save',
            back: 'Back',
            export: 'Export',
            import: 'Import',
            exportAll: 'Export All',
            importExam: 'Import Exam',
            addExaminee: 'Add Examinee',
            removeExaminee: 'Remove Examinee',
            firstName: 'First Name',
            lastName: 'Last Name',
            fullName: 'Full Name',
            dateOfBirth: 'Date of Birth',
            age: 'Age',
            rank: 'Rank',
            club: 'Club',
            trainingStartDate: 'Training Start Date',
            lastExamDate: 'Last Exam Date',
            trainingsPerWeek: 'Trainings Per Week',
            photo: 'Photo',
            uploadPhoto: 'Upload Photo',
            removePhoto: 'Remove Photo',
            noExams: 'No exams yet. Create a new exam to get started.',
            examinees: 'Examinees',
            confirmDelete: 'Are you sure you want to delete?',
            confirmDeleteExam: 'Are you sure you want to delete this exam?',
            confirmDeleteExaminee: 'Are you sure you want to remove this examinee?',
            dataSaved: 'Data saved',
            category: 'Category',
            enterNotes: 'Enter notes...',
            examInfo: 'Exam Info',
            examineeDetails: 'Examinee Details'
        }
    };

    var currentLang = 'he';

    function setLang(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
        document.body.dir = lang === 'he' ? 'rtl' : 'ltr';
    }

    function getLang() {
        return currentLang;
    }

    function t(key) {
        return (strings[currentLang] && strings[currentLang][key]) || key;
    }

    function getCategoryName(categoryKey) {
        var cat = App.Utils.CATEGORIES.find(function (c) { return c.key === categoryKey; });
        return cat ? cat[currentLang] : categoryKey;
    }

    return {
        setLang: setLang,
        getLang: getLang,
        t: t,
        getCategoryName: getCategoryName
    };
})();
