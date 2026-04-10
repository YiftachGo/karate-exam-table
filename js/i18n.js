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
            examineeDetails: 'פרטי נבחן',
            // Auth
            login: 'התחבר',
            signup: 'הרשמה',
            logout: 'יציאה',
            email: 'אימייל',
            password: 'סיסמה',
            displayName: 'שם תצוגה',
            signInWithGoogle: 'התחבר עם Google',
            or: 'או',
            noAccount: 'אין לך חשבון? הירשם',
            hasAccount: 'יש לך חשבון? התחבר',
            loginSubtitle: 'התחבר כדי לנהל מבחני קרטה',
            fillAllFields: 'אנא מלא את כל השדות',
            passwordTooShort: 'הסיסמה חייבת להיות לפחות 6 תווים',
            invalidCredentials: 'אימייל או סיסמה לא נכונים',
            emailInUse: 'אימייל זה כבר בשימוש',
            // Multi-trainer
            shareExam: 'שתף מבחן',
            inviteTrainer: 'הזמן מאמן',
            trainerEmail: 'אימייל המאמן',
            addTrainer: 'הוסף מאמן',
            trainerAdded: 'מאמן נוסף בהצלחה',
            trainerNotFound: 'לא נמצא משתמש עם אימייל זה',
            sharedTrainers: 'מאמנים משותפים',
            you: 'אתה',
            owner: 'בעלים',
            // Invitation
            inviteExaminees: 'הזמן נבחנים',
            invitationLink: 'לינק להזמנה',
            accessCode: 'קוד גישה',
            copyLink: 'העתק לינק',
            copyCode: 'העתק קוד',
            copied: 'הועתק!',
            enterAccessCode: 'הכנס קוד גישה',
            verify: 'אמת',
            invalidCode: 'קוד גישה שגוי',
            registrationTitle: 'רישום למבחן קרטה',
            registrationSubtitle: 'מלא את הפרטים שלך',
            submitRegistration: 'שלח רישום',
            registrationSuccess: 'נרשמת בהצלחה! בהצלחה במבחן.',
            thankYou: 'תודה!',
            loading: 'טוען...',
            error: 'שגיאה',
            // Drag & Drop
            dragToReorder: 'גרור לשינוי סדר',
            // Pass/Fail
            pass: 'עבר',
            fail: 'לא עבר',
            // Recommendation Export
            exportRecommendation: 'ייצוא דף המלצות',
            examNotes: 'הערות מבחן',
            generatedOn: 'הופק בתאריך',
            // Prerequisites
            prerequisites: 'דרישות קדם',
            beltTrainings: 'אימוני שחורות',
            gasshukuCount: 'גשוקואים',
            examPayment: 'תשלום מבחן',
            selectStatus: 'בחר סטטוס',
            paid: 'שולם',
            unpaid: 'לא שולם',
            exempt: 'פטור'
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
            examineeDetails: 'Examinee Details',
            // Auth
            login: 'Log In',
            signup: 'Sign Up',
            logout: 'Log Out',
            email: 'Email',
            password: 'Password',
            displayName: 'Display Name',
            signInWithGoogle: 'Sign in with Google',
            or: 'or',
            noAccount: "Don't have an account? Sign up",
            hasAccount: 'Already have an account? Log in',
            loginSubtitle: 'Sign in to manage karate exams',
            fillAllFields: 'Please fill in all fields',
            passwordTooShort: 'Password must be at least 6 characters',
            invalidCredentials: 'Invalid email or password',
            emailInUse: 'This email is already in use',
            // Multi-trainer
            shareExam: 'Share Exam',
            inviteTrainer: 'Invite Trainer',
            trainerEmail: 'Trainer Email',
            addTrainer: 'Add Trainer',
            trainerAdded: 'Trainer added successfully',
            trainerNotFound: 'No user found with this email',
            sharedTrainers: 'Shared Trainers',
            you: 'You',
            owner: 'Owner',
            // Invitation
            inviteExaminees: 'Invite Examinees',
            invitationLink: 'Invitation Link',
            accessCode: 'Access Code',
            copyLink: 'Copy Link',
            copyCode: 'Copy Code',
            copied: 'Copied!',
            enterAccessCode: 'Enter Access Code',
            verify: 'Verify',
            invalidCode: 'Invalid access code',
            registrationTitle: 'Karate Exam Registration',
            registrationSubtitle: 'Fill in your details',
            submitRegistration: 'Submit Registration',
            registrationSuccess: 'Registration successful! Good luck on the exam.',
            thankYou: 'Thank You!',
            loading: 'Loading...',
            error: 'Error',
            // Drag & Drop
            dragToReorder: 'Drag to reorder',
            // Pass/Fail
            pass: 'Pass',
            fail: 'Fail',
            // Recommendation Export
            exportRecommendation: 'Export Recommendation',
            examNotes: 'Exam Notes',
            generatedOn: 'Generated on',
            // Prerequisites
            prerequisites: 'Prerequisites',
            beltTrainings: 'Belt Trainings',
            gasshukuCount: 'Gasshuku Attended',
            examPayment: 'Exam Payment',
            selectStatus: 'Select status',
            paid: 'Paid',
            unpaid: 'Unpaid',
            exempt: 'Exempt'
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
