var App = window.App || {};

App.PhotoUpload = (function () {

    function resizeImage(dataUrl, maxSize) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var w = img.width;
                var h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h = Math.round(h * maxSize / w);
                        w = maxSize;
                    } else {
                        w = Math.round(w * maxSize / h);
                        h = maxSize;
                    }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = dataUrl;
        });
    }

    async function uploadPhoto(examId, examineeId, file) {
        var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) { resolve(e.target.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Resize and save as base64 in Firestore
        var resized = await resizeImage(dataUrl, 200);
        await App.Storage.updateExaminee(examId, examineeId, { photoUrl: resized });
        return resized;
    }

    async function removePhoto(examId, examineeId) {
        await App.Storage.updateExaminee(examId, examineeId, { photoUrl: '' });
    }

    async function uploadPhotoPublic(examId, examineeId, file) {
        var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) { resolve(e.target.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        return await resizeImage(dataUrl, 200);
    }

    return {
        uploadPhoto: uploadPhoto,
        removePhoto: removePhoto,
        uploadPhotoPublic: uploadPhotoPublic,
        resizeImage: resizeImage
    };
})();
