/**
 * MB TECH — financas/js/avatar.js
 * Módulo de Perfil e Foto Profissional (LinkedIn Style)
 */

'use strict';

let cropState = {
    img: null,
    scale: 1,
    x: 0,
    y: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    originalWidth: 0,
    originalHeight: 0,
    viewportSize: 280,
    profileData: null,
    // Handlers para remoção limpa
    handleMouseMove: null,
    handleMouseUp: null,
    handleTouchMove: null,
    handleTouchEnd: null
};

const Avatar = {

    init: () => {
        // Usar delegação ou garantir listener único
        const trigger = document.getElementById('userProfileTrigger');
        if (trigger) {
            trigger.onclick = (e) => { e.preventDefault(); Avatar.openModal(); };
        }

        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) {
            saveBtn.onclick = () => Avatar.saveProfile();
        }

        const closeBtn = document.getElementById('closeProfileModal');
        if (closeBtn) {
            closeBtn.onclick = () => Avatar.closeModal();
        }

        Avatar.updateDisplay();
    },

    getInitials: (name) => {
        if (!name) return '??';
        return name
            .trim()
            .split(' ')
            .filter(n => n.length > 0)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    },

    updateDisplay: () => {
        const profile = Storage.getProfile();
        const headerAvatar = document.getElementById('headerAvatar');
        const previewAvatar = document.getElementById('profilePhotoPreview');

        [headerAvatar, previewAvatar].forEach(el => {
            if (!el) return;
            if (profile.photo) {
                el.style.backgroundImage = `url(${profile.photo})`;
                el.textContent = '';
                el.style.backgroundColor = 'transparent';
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            } else {
                el.style.backgroundImage = 'none';
                el.textContent = Avatar.getInitials(profile.name);
                el.style.backgroundColor = profile.color || '#10b981';
            }
        });
    },

    openModal: () => {
        // Proteção caso o Storage ainda não tenha retornado dados
        const profile = (typeof Storage !== 'undefined' && Storage.getProfile) 
            ? Storage.getProfile() 
            : { name: 'Usuário', photo: null, color: '#10b981' };
        
        cropState.profileData = JSON.parse(JSON.stringify(profile)); // Deep copy para edição

        const nameInput = document.getElementById('userNameInput');
        const photoInput = document.getElementById('userPhotoInput');
        const removeBtn = document.getElementById('removePhotoBtn');
        const picker = document.getElementById('avatarColorPicker');

        if (nameInput) nameInput.value = profile.name || '';
        if (photoInput) photoInput.value = '';
        if (removeBtn) removeBtn.style.display = profile.photo ? 'block' : 'none';

        Avatar.updateDisplay();

        // Cores do sistema financas
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
        if (picker) {
            picker.innerHTML = '';
            colors.forEach(color => {
                const dot = document.createElement('button');
                dot.className = `color-dot ${profile.color === color ? 'selected' : ''}`;
                dot.style.background = color;
                dot.onclick = () => {
                    cropState.profileData.color = color;
                    picker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
                    dot.classList.add('selected');
                    Avatar.updateDisplayLocally();
                };
                picker.appendChild(dot);
            });
        }

        if (photoInput) {
            photoInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                if (!validTypes.includes(file.type)) {
                    Utils.showToast('🚫 Formato inválido. Use JPG, PNG ou WEBP.', 'error');
                    photoInput.value = '';
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    Utils.showToast('🚫 Arquivo muito grande (máx 5MB).', 'error');
                    photoInput.value = '';
                    return;
                }

                Avatar.initCropEditor(file);
            };
        }

        if (removeBtn) {
            removeBtn.onclick = () => {
                cropState.profileData.photo = null;
                if (photoInput) photoInput.value = '';
                removeBtn.style.display = 'none';
                Avatar.updateDisplayLocally();
                Utils.showToast('🗑️ Foto removida.');
            };
        }

        const clearBtn = document.getElementById('btnClearCache');
        if (clearBtn) {
            clearBtn.onclick = () => {
                Utils.confirmAction('⚠️ Isso apagará permanentemente todas as suas transações, metas e configurações salvas localmente. Deseja continuar?', () => {
                    // Remove as chaves definidas no STORAGE_KEYS (Storage.js)
                    if (typeof STORAGE_KEYS !== 'undefined') {
                        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
                    }
                    // Remove chaves auxiliares de UI e alertas
                    localStorage.removeItem('financas_ui_cache');
                    localStorage.removeItem('financas_critical_alerts');
                    localStorage.removeItem('privacyMode');
                    
                    Utils.showToast('🚀 Cache limpo com sucesso!', 'success');
                    setTimeout(() => window.location.reload(), 1200);
                });
            };
        }

        const modal = document.getElementById('profileModal');
        if (modal) modal.classList.add('active'); // Alterado para active para manter consistência com app.js
    },

    updateDisplayLocally: () => {
        const profile = cropState.profileData;
        const headerAvatar = document.getElementById('headerAvatar');
        const previewAvatar = document.getElementById('profilePhotoPreview');

        [headerAvatar, previewAvatar].forEach(el => {
            if (!el) return;
            if (profile.photo) {
                el.style.backgroundImage = `url(${profile.photo})`;
                el.textContent = '';
                el.style.backgroundColor = 'transparent';
            } else {
                el.style.backgroundImage = 'none';
                el.textContent = Avatar.getInitials(profile.name);
                el.style.backgroundColor = profile.color || '#10b981';
            }
        });
    },

    closeModal: () => {
        // Cleanup listeners de recorte se estiverem ativos
        Avatar.endDrag();
        const overlay = document.getElementById('cropEditorOverlay');
        if (overlay) overlay.classList.remove('open');
        
        const modal = document.getElementById('profileModal');
        if (modal) modal.classList.remove('active');
    },

    saveProfile: () => {
        const nameInput = document.getElementById('userNameInput');
        const nameValue = nameInput ? nameInput.value.trim() : '';

        // Validação: Apenas letras e espaços (inclui acentos latinos)
        const nameRegex = /^[A-Za-zÀ-ÿ\s]+$/;
        
        if (nameValue && !nameRegex.test(nameValue)) {
            Utils.showToast('⚠️ O nome deve conter apenas letras.', 'error');
            nameInput.focus();
            return;
        }
        
        cropState.profileData.name = nameValue || 'Usuário';

        if (typeof Storage !== 'undefined' && Storage.saveProfile) {
            Storage.saveProfile(cropState.profileData);
        }
        Avatar.updateDisplay();
        Avatar.closeModal();
        Utils.showToast('👤 Perfil atualizado!');
    },

    initCropEditor: (file) => {
        const overlay = document.getElementById('cropEditorOverlay');
        const cropImg = document.getElementById('cropImage');
        const zoomRange = document.getElementById('zoomRange');
        const viewport = document.getElementById('cropViewport');
        const reader = new FileReader();

        reader.onload = (e) => {
            cropImg.src = e.target.result;
            cropImg.onload = () => {
                overlay.classList.add('open');

                // Lógica LinkedIn: Cobrir o viewport (cover)
                const aspect = cropImg.naturalWidth / cropImg.naturalHeight;
                const minScale = aspect > 1 
                    ? cropState.viewportSize / cropImg.naturalHeight 
                    : cropState.viewportSize / cropImg.naturalWidth;

                cropState.originalWidth = cropImg.naturalWidth * minScale;
                cropState.originalHeight = cropImg.naturalHeight * minScale;

                cropState.scale = 1;
                cropState.x = (cropState.viewportSize - cropState.originalWidth) / 2;
                cropState.y = (cropState.viewportSize - cropState.originalHeight) / 2;
                
                zoomRange.value = 1;
                Avatar.updateCropTransform();
            };
        };
        reader.readAsDataURL(file);

        const startDrag = (e) => {
            if (cropState.isDragging) return;
            cropState.isDragging = true;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            cropState.startX = clientX - cropState.x;
            cropState.startY = clientY - cropState.y;
            viewport.style.cursor = 'grabbing';
            
            cropState.handleMouseMove = (ev) => Avatar.doDrag(ev);
            cropState.handleMouseUp = () => Avatar.endDrag();
            cropState.handleTouchMove = (ev) => Avatar.doDrag(ev);
            cropState.handleTouchEnd = () => Avatar.endDrag();

            window.addEventListener('mousemove', cropState.handleMouseMove);
            window.addEventListener('mouseup', cropState.handleMouseUp);
            window.addEventListener('touchmove', cropState.handleTouchMove, { passive: false });
            window.addEventListener('touchend', cropState.handleTouchEnd);
        };

        viewport.onmousedown = startDrag;
        viewport.ontouchstart = startDrag;

        zoomRange.oninput = (e) => {
            const oldScale = cropState.scale;
            cropState.scale = parseFloat(e.target.value);
            
            // Zoom centralizado
            const center = cropState.viewportSize / 2;
            cropState.x = center - (center - cropState.x) * (cropState.scale / oldScale);
            cropState.y = center - (center - cropState.y) * (cropState.scale / oldScale);

            Avatar.constrainBounds();
            Avatar.updateCropTransform();
        };

        document.getElementById('cancelCropBtn').onclick = () => {
            overlay.classList.remove('open');
            document.getElementById('userPhotoInput').value = '';
            Avatar.endDrag();
        };

        document.getElementById('applyCropBtn').onclick = () => Avatar.applyCrop();
    },

    doDrag: (e) => {
        if (!cropState.isDragging) return;
        if (e.cancelable) e.preventDefault();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        let newX = clientX - cropState.startX;
        let newY = clientY - cropState.startY;

        cropState.x = newX;
        cropState.y = newY;
        
        Avatar.constrainBounds();
        Avatar.updateCropTransform();
    },

    constrainBounds: () => {
        const scaledWidth = cropState.originalWidth * cropState.scale;
        const scaledHeight = cropState.originalHeight * cropState.scale;
        
        // Impedir que a imagem fique menor que o círculo (espaços vazios)
        cropState.x = Math.min(0, Math.max(cropState.x, cropState.viewportSize - scaledWidth));
        cropState.y = Math.min(0, Math.max(cropState.y, cropState.viewportSize - scaledHeight));
    },

    endDrag: () => {
        if (!cropState.isDragging) return;
        cropState.isDragging = false;
        const viewport = document.getElementById('cropViewport');
        if (viewport) viewport.style.cursor = 'move';
        
        window.removeEventListener('mousemove', cropState.handleMouseMove);
        window.removeEventListener('mouseup', cropState.handleMouseUp);
        window.removeEventListener('touchmove', cropState.handleTouchMove);
        window.removeEventListener('touchend', cropState.handleTouchEnd);
    },

    updateCropTransform: () => {
        const cropImg = document.getElementById('cropImage');
        const scaledWidth = cropState.originalWidth * cropState.scale;
        const scaledHeight = cropState.originalHeight * cropState.scale;
        cropImg.style.width = `${scaledWidth}px`;
        cropImg.style.height = `${scaledHeight}px`;
        cropImg.style.left = `${cropState.x}px`;
        cropImg.style.top = `${cropState.y}px`;
    },

    applyCrop: () => {
        const cropImg = document.getElementById('cropImage');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Qualidade profissional 400x400
        canvas.width = 400;
        canvas.height = 400;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const ratio = cropImg.naturalWidth / (cropState.originalWidth * cropState.scale);
        const sx = Math.abs(cropState.x) * ratio;
        const sy = Math.abs(cropState.y) * ratio;
        const sSize = cropState.viewportSize * ratio;

        // Desenhar recorte no canvas
        ctx.drawImage(cropImg, sx, sy, sSize, sSize, 0, 0, 400, 400);

        const photoData = canvas.toDataURL('image/jpeg', 0.9);
        
        cropState.profileData.photo = photoData;
        Avatar.updateDisplayLocally();
        
        const removeBtn = document.getElementById('removePhotoBtn');
        if (removeBtn) removeBtn.style.display = 'block';

        document.getElementById('cropEditorOverlay').classList.remove('open');
        Utils.showToast('✨ Foto ajustada!');
    }
};

// Auto-init
document.addEventListener('DOMContentLoaded', Avatar.init);
