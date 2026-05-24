var App = window.App || {};

// Touch-screen drawing module.
// Opens a canvas (full-screen modal on touch, inline on desktop) where the trainer
// can finger/stylus-draw notes as an alternative to typing.
// On save, returns a base64 PNG data URL. The caller stores it in Firestore alongside
// the text field, with a `_mode` flag controlling which to display.

App.Drawing = (function () {
    var PEN_WIDTH = 2.5;
    var ERASER_WIDTH = 18;
    var MAX_HISTORY = 50;

    // Canvas dimensions
    var MODAL_MAX_W = 900;
    var MODAL_MAX_H_RATIO = 0.7;
    var INLINE_W = 380;
    var INLINE_H = 180;

    function isTouch() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    // Opens a canvas overlay. Returns Promise resolving to { action, dataUrl }
    // action: 'save' or 'cancel'
    // opts: { initialDataUrl, title }
    function openCanvas(opts) {
        opts = opts || {};
        var t = App.I18n.t;
        var useModal = isTouch();

        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.className = useModal ? 'drawing-overlay drawing-overlay-modal' : 'drawing-overlay drawing-overlay-inline';

            var box = document.createElement('div');
            box.className = 'drawing-box';
            overlay.appendChild(box);

            // Header (title + close)
            var header = document.createElement('div');
            header.className = 'drawing-header';
            var titleEl = document.createElement('div');
            titleEl.className = 'drawing-title';
            titleEl.textContent = opts.title || t('drawMode');
            header.appendChild(titleEl);
            box.appendChild(header);

            // Toolbar
            var toolbar = document.createElement('div');
            toolbar.className = 'drawing-toolbar';
            var penBtn = _toolBtn('pen', t('pen'), '✏');
            var eraserBtn = _toolBtn('eraser', t('eraser'), '🩹');
            var undoBtn = _toolBtn('undo', t('undo'), '↶');
            var clearBtn = _toolBtn('clear', t('clear'), '🗑');
            penBtn.classList.add('active');
            toolbar.appendChild(penBtn);
            toolbar.appendChild(eraserBtn);
            toolbar.appendChild(undoBtn);
            toolbar.appendChild(clearBtn);
            box.appendChild(toolbar);

            // Canvas
            var canvas = document.createElement('canvas');
            canvas.className = 'drawing-canvas';
            // Determine canvas size
            var cw, ch;
            if (useModal) {
                cw = Math.min(window.innerWidth - 32, MODAL_MAX_W);
                ch = Math.min(Math.floor(window.innerHeight * MODAL_MAX_H_RATIO), 600);
            } else {
                cw = INLINE_W;
                ch = INLINE_H;
            }
            canvas.width = cw;
            canvas.height = ch;
            canvas.style.width = cw + 'px';
            canvas.style.height = ch + 'px';
            box.appendChild(canvas);

            // Action buttons
            var actions = document.createElement('div');
            actions.className = 'drawing-actions';
            var saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-primary';
            saveBtn.textContent = t('save');
            var cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-outline';
            cancelBtn.textContent = t('cancel');
            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            box.appendChild(actions);

            document.body.appendChild(overlay);

            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#111';

            // Load initial drawing
            if (opts.initialDataUrl) {
                var img = new Image();
                img.onload = function () {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    pushHistory();
                };
                img.src = opts.initialDataUrl;
            } else {
                pushHistory();
            }

            // State
            var tool = 'pen';
            var drawing = false;
            var lastX = 0, lastY = 0;
            var history = []; // Array of ImageData snapshots

            function pushHistory() {
                try {
                    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                    if (history.length > MAX_HISTORY) history.shift();
                } catch (e) { /* tainted canvas — ignore */ }
            }

            function popHistory() {
                if (history.length <= 1) return; // keep initial state
                history.pop();
                var prev = history[history.length - 1];
                ctx.putImageData(prev, 0, 0);
            }

            function setTool(t) {
                tool = t;
                penBtn.classList.toggle('active', t === 'pen');
                eraserBtn.classList.toggle('active', t === 'eraser');
            }
            penBtn.addEventListener('click', function () { setTool('pen'); });
            eraserBtn.addEventListener('click', function () { setTool('eraser'); });
            undoBtn.addEventListener('click', popHistory);
            clearBtn.addEventListener('click', function () {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                pushHistory();
            });

            function getPoint(e) {
                var rect = canvas.getBoundingClientRect();
                var x = (e.clientX - rect.left) * (canvas.width / rect.width);
                var y = (e.clientY - rect.top) * (canvas.height / rect.height);
                return { x: x, y: y };
            }

            function startDraw(e) {
                e.preventDefault();
                drawing = true;
                var p = getPoint(e);
                lastX = p.x; lastY = p.y;
                ctx.beginPath();
                if (tool === 'eraser') {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = ERASER_WIDTH;
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = '#111';
                    ctx.lineWidth = PEN_WIDTH;
                }
                // Single dot
                ctx.beginPath();
                ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fill();
            }

            function moveDraw(e) {
                if (!drawing) return;
                e.preventDefault();
                var p = getPoint(e);
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                lastX = p.x; lastY = p.y;
            }

            function endDraw(e) {
                if (!drawing) return;
                if (e) e.preventDefault();
                drawing = false;
                pushHistory();
            }

            canvas.addEventListener('pointerdown', startDraw);
            canvas.addEventListener('pointermove', moveDraw);
            canvas.addEventListener('pointerup', endDraw);
            canvas.addEventListener('pointercancel', endDraw);
            canvas.addEventListener('pointerleave', endDraw);
            // Prevent touch scrolling on canvas
            canvas.style.touchAction = 'none';

            function cleanup() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                document.removeEventListener('keydown', onKey);
            }

            function onKey(e) {
                if (e.key === 'Escape') { cleanup(); resolve({ action: 'cancel' }); }
            }
            document.addEventListener('keydown', onKey);

            saveBtn.addEventListener('click', function () {
                var dataUrl = canvas.toDataURL('image/png');
                cleanup();
                resolve({ action: 'save', dataUrl: dataUrl });
            });
            cancelBtn.addEventListener('click', function () {
                cleanup();
                resolve({ action: 'cancel' });
            });

            // Click outside modal closes (cancel)
            if (useModal) {
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) { cleanup(); resolve({ action: 'cancel' }); }
                });
            }
        });
    }

    function _toolBtn(name, label, glyph) {
        var b = document.createElement('button');
        b.className = 'drawing-tool-btn drawing-tool-' + name;
        b.type = 'button';
        b.title = label;
        b.textContent = glyph;
        return b;
    }

    return {
        openCanvas: openCanvas,
        isTouch: isTouch
    };
})();
