var App = window.App || {};

App.PhotoUpload = (function () {

    // A JPEG this app produced is several KB; anything this short is a canvas that
    // failed to encode ("data:,") rather than a photo.
    var MIN_PHOTO_LENGTH = 200;

    // True for a usable stored photo: a real image data URL, or an http(s) URL.
    function isUsablePhoto(url) {
        if (typeof url !== 'string') return false;
        if (/^https?:\/\//.test(url)) return true;
        return url.indexOf('data:image/') === 0 && url.length > MIN_PHOTO_LENGTH;
    }

    // Resolves to a JPEG data URL no larger than maxSize, or rejects with
    // Error('image_unreadable').
    //
    // It used to resolve only from onload. A file the browser cannot decode — an
    // iPhone HEIC photo on a desktop, a damaged file — fires onerror instead, so
    // the promise never settled and registration sat on "loading" forever.
    function resizeImage(source, maxSize) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
                var w = img.naturalWidth || img.width;
                var h = img.naturalHeight || img.height;
                if (!w || !h) { reject(new Error('image_unreadable')); return; }
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h = Math.round(h * maxSize / w);
                        w = maxSize;
                    } else {
                        w = Math.round(w * maxSize / h);
                        h = maxSize;
                    }
                }
                try {
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    var out = canvas.toDataURL('image/jpeg', 0.8);
                    if (!isUsablePhoto(out)) { reject(new Error('image_unreadable')); return; }
                    resolve(out);
                } catch (e) {
                    reject(new Error('image_unreadable'));
                }
            };
            img.onerror = function () { reject(new Error('image_unreadable')); };
            img.src = source;
        });
    }

    // File -> resized JPEG data URL. Decodes from an object URL rather than a
    // FileReader data URL, which spares holding a base64 copy of a multi-megabyte
    // phone photo in memory. A file the phone cannot hand over (on Android, a photo
    // that lives only in cloud storage) fails here and rejects instead of being
    // skipped.
    async function fileToPhoto(file) {
        if (!file) throw new Error('image_unreadable');
        var url = URL.createObjectURL(file);
        try {
            return await resizeImage(url, 200);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    async function uploadPhoto(examId, examineeId, file) {
        var resized = await fileToPhoto(file);
        await App.Storage.updateExaminee(examId, examineeId, { photoUrl: resized });
        return resized;
    }

    async function removePhoto(examId, examineeId) {
        await App.Storage.updateExaminee(examId, examineeId, { photoUrl: '' });
    }

    async function uploadPhotoPublic(examId, examineeId, file) {
        return fileToPhoto(file);
    }

    return {
        uploadPhoto: uploadPhoto,
        removePhoto: removePhoto,
        uploadPhotoPublic: uploadPhotoPublic,
        resizeImage: resizeImage,
        isUsablePhoto: isUsablePhoto
    };
})();
