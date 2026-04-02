//window.alert("FILE LOADED - APP.JS V8"); // Diagnostic for cache
// Core Application State
let mapData = {
    nodes: [],
    edges: []
};
let currentMapId = null;
let currentMapTitle = "Untitled Mind Map";
let currentMapDesc = "";
let currentListViewMode = 'grid'; // 'grid' or 'table'
let draggedNodeId = null; 
let potentialParentId = null; // For reparenting

// Canvas Transformation State
let transform = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    scale: 1,
};

let activeNodeId = null; 

// DOM Elements
const landingView = document.getElementById('landing-view');
const editorView = document.getElementById('editor-view');
const mapsList = document.getElementById('maps-list');
const btnViewGrid = document.getElementById('btn-view-grid');
const btnViewTable = document.getElementById('btn-view-table');
const btnCreateNew = document.getElementById('btn-create-new');
const btnBackToList = document.getElementById('btn-back-to-list');
const currentMapTitleEl = document.getElementById('current-map-title');
const btnEditMapInfo = document.getElementById('btn-edit-map-info');

const mapInfoEditor = document.getElementById('map-info-editor');
const mapEditTitle = document.getElementById('map-edit-title');
const mapEditDesc = document.getElementById('map-edit-desc');
const btnMapInfoSave = document.getElementById('btn-map-info-save');
const btnMapInfoCancel = document.getElementById('btn-map-info-cancel');

const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmMsg = document.getElementById('delete-confirm-msg');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');

const workspace = document.getElementById('workspace');
const canvas = document.getElementById('canvas');
const edgesLayer = document.getElementById('edges-layer');
const nodesLayer = document.getElementById('nodes-layer');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomLevelTxt = document.getElementById('zoom-level');
const centerBtn = document.getElementById('center-btn');
const saveBtn = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');

// Editor Elements
const editorWrapper = document.getElementById('editor-wrapper');
const editTitle = document.getElementById('edit-title');
const editDesc = document.getElementById('edit-desc');
const btnEditorSave = document.getElementById('btn-editor-save');
const btnEditorCancel = document.getElementById('btn-editor-cancel');

// Side Guide Elements
const guideChild = document.getElementById('guide-child');
const guideSibling = document.getElementById('guide-sibling');
const guideDelete = document.getElementById('guide-delete');

// Export Modal Elements
const exportBtn = document.getElementById('export-btn');
const dataModal = document.getElementById('data-modal');
const closeModal = document.getElementById('close-modal');
const jsonDisplay = document.getElementById('json-display');
const copyJsonBtn = document.getElementById('copy-json');

// Initialize
async function init() {
    console.log("MindFlow Engine Initializing...");
    //alert("MindFlow JS Loaded (Debug v4)"); // If user does not see this, cache is unbroken!
    
    updateTransform();
    
    setupEventListeners();
    setupKeyboardShortcuts();
    setupDashboardDelegation();
    
    // Load Global User Preferences (Theme)
    await loadThemeSetting();
    
    // Start at Landing Page
    showLanding();
}

async function loadThemeSetting() {
    try {
        const response = await fetch('/api/settings/theme');
        const data = await response.json();
        if (data && data.setting_value) {
            const theme = data.setting_value;
            applyTheme(theme);
            // Update all theme selects to match
            document.querySelectorAll('.theme-select-common').forEach(sel => {
                sel.value = theme;
            });
        }
    } catch (err) {
        console.error("Failed to load theme setting:", err);
    }
}

function applyTheme(theme) {
    document.body.className = theme === 'default' ? '' : `theme-${theme}`;
    if (typeof renderEdges === 'function') renderEdges();
}

async function saveThemeSetting(theme) {
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'theme', value: theme })
        });
    } catch (err) {
        console.error("Failed to save theme setting:", err);
    }
}

function showLanding() {
    landingView.classList.remove('hidden');
    editorView.classList.add('hidden');
    loadMapsList();
}

function showEditor(mapId) {
    currentMapId = mapId;
    landingView.classList.add('hidden');
    editorView.classList.remove('hidden');
    loadMapDetail(mapId);
}

async function loadMapsList() {
    mapsList.innerHTML = '<div class="loading-spinner">Loading maps...</div>';
    try {
        const response = await fetch(`/api/maps?t=${Date.now()}`); // Add timestamp to avoid cache
        if (response.ok) {
            const maps = await response.json();
            renderMapsList(maps);
        } else {
            console.error("API Error:", response.status);
            mapsList.innerHTML = '<div class="error">서버 오류가 발생했습니다.</div>';
        }
    } catch (err) {
        console.error("Failed to load maps list", err);
        mapsList.innerHTML = '<div class="error">Failed to load maps. Check DB connection.</div>';
    }
}

function renderMapsList(maps) {
    if (maps.length === 0) {
        mapsList.innerHTML = '<div class="loading-spinner">No mind maps yet. Create one!</div>';
        return;
    }
    
    mapsList.innerHTML = '';
    
    if (currentListViewMode === 'grid') {
        mapsList.className = 'maps-grid';
        renderGridView(maps);
    } else {
        mapsList.className = 'maps-table-container';
        renderTableView(maps);
    }
}

function renderGridView(maps) {
    maps.forEach(map => {
        const card = document.createElement('div');
        card.className = 'map-card';
        card.setAttribute('data-id', map.id);
        card.innerHTML = `
            <h3 class="map-title-text">${map.title || 'Untitled'}</h3>
            <p>${map.description || 'No description'}</p>
            <div class="card-footer">
                <span>Updated: ${new Date(map.updated_at).toLocaleDateString()}</span>
                <button class="btn-delete-map" data-id="${map.id}" data-title="${map.title || 'Untitled'}">Delete</button>
            </div>
        `;
        mapsList.appendChild(card);
    });
}

function renderTableView(maps) {
    const table = document.createElement('table');
    table.className = 'maps-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Updated</th>
                <th class="col-actions">Actions</th>
            </tr>
        </thead>
        <tbody>
            ${maps.map(map => `
                <tr data-id="${map.id}">
                    <td class="col-title">${map.title || 'Untitled'}</td>
                    <td class="col-desc">${map.description || ''}</td>
                    <td>${new Date(map.updated_at).toLocaleDateString()}</td>
                    <td class="col-actions">
                        <button class="btn-delete-map" data-id="${map.id}" data-title="${map.title || 'Untitled'}">Delete</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    mapsList.appendChild(table);
}

// Use Global Event Delegation for Dashboard
function setupDashboardDelegation() {
    document.body.addEventListener('click', async (e) => {
        // Quick short-circuit if we aren't even visible
        if (landingView.classList.contains('hidden')) return;

        const deleteBtn = e.target.closest('.btn-delete-map');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const id = deleteBtn.getAttribute('data-id');
            const title = deleteBtn.getAttribute('data-title');
            
            // diagnostic
            //alert("삭제 팝업을 띄웁니다: ID " + id);
            console.log("Delete button clicked for", id);
            showDeleteConfirm(id, title);
            return;
        }
        
        // Check for card or row click to open editor
        const card = e.target.closest('.map-card');
        const row = e.target.closest('.maps-table tr');
        
        // Prevent opening editor when clicking on view toggles
        if (e.target.closest('.view-toggle')) return;

        if (card || row) {
            const id = (card || row).getAttribute('data-id');
            if (id) {
                e.preventDefault();
                showEditor(id);
            }
        }
    });
    
    // Close delete modal on cancel
    deleteConfirmModal.onclick = (e) => {
        if (e.target === deleteConfirmModal) closeDeleteConfirm();
    };
}

function showDeleteConfirm(id, title) {
    console.log(`Showing delete confirm for map ID: ${id}, Title: ${title}`);
    
    // Get fresh elements every time to avoid null/stale references
    const modal = document.getElementById('delete-confirm-modal');
    const msg = document.getElementById('delete-confirm-msg');
    const btnConfirm = document.getElementById('btn-delete-confirm');
    
    if (!modal || !msg || !btnConfirm) {
        console.error("Critical: Delete modal elements not found!");
        return;
    }

    msg.innerText = `정말 "${title || 'Untitled'}" 마인드맵을 삭제하시겠습니까?`;
    btnConfirm.innerText = "삭제";
    btnConfirm.disabled = false;
    
    
    
    //window.alert("삭제 팝업을 띄웁니다 (V6 Force)");
    
    // Force visibility with direct style attribute and extreme z-index
    modal.setAttribute('style', 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; z-index: 999999 !important;');
    modal.classList.remove('hidden');
    modal.classList.add('visible');

    btnConfirm.onclick = async () => {
        console.log(`Confirmed deletion of map ID: ${id}`);
        btnConfirm.disabled = true;
        btnConfirm.innerText = "삭제 중...";
        
        try {
            const success = await deleteMap(id);
            if (success) {
                closeDeleteConfirm();
                setTimeout(() => loadMapsList(), 300);
            } else {
                btnConfirm.innerText = "삭제";
                btnConfirm.disabled = false;
            }
        } catch (err) {
            console.error("Deletion error", err);
            btnConfirm.innerText = "삭제";
            btnConfirm.disabled = false;
        }
    };

    const btnCancel = document.getElementById('btn-delete-cancel');
    if (btnCancel) btnCancel.onclick = closeDeleteConfirm;
}

function closeDeleteConfirm() {
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.setAttribute('style', 'display: none !important;');
        modal.classList.add('hidden');
        modal.classList.remove('visible');
    }
}

async function loadMapDetail(id) {
    try {
        const response = await fetch(`/api/maps/${id}`);
        if (response.ok) {
            const data = await response.json();
            mapData = data.map_data;
            currentMapTitle = data.title;
            currentMapDesc = data.description;
            currentMapTitleEl.innerText = currentMapTitle;
            
            saveStatus.innerText = "Loaded successfully";
            render();
            // Reset transform to center
            transform.x = window.innerWidth / 2;
            transform.y = window.innerHeight / 2;
            transform.scale = 1;
            updateTransform();

            // Auto-select root node for keyboard navigation
            const rootNode = mapData.nodes.find(n => n.id === 'root' || n.isRoot);
            if (rootNode) {
                setTimeout(() => selectNode(rootNode.id), 100);
            }
        }
    } catch (err) {
        console.error("Failed to load map data", err);
    }
}

async function saveMapData() {
    if (!currentMapId) return;
    saveStatus.innerText = "Saving...";
    try {
        const res = await fetch(`/api/maps/${currentMapId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: currentMapTitle,
                description: currentMapDesc,
                map_data: mapData
            })
        });
        if (res.ok) {
            saveStatus.innerText = "All changes saved";
        }
    } catch(err) {
        saveStatus.innerText = "Offline - Not saved";
    }
}

async function createNewMap() {
    try {
        const res = await fetch('/api/maps', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            showEditor(data.id);
        }
    } catch (err) {
        console.error("Failed to create map", err);
    }
}

async function deleteMap(id) {
    try {
        const response = await fetch(`/api/maps/${id}`, { method: 'DELETE' });
        if (response.ok) {
            console.log(`Map ${id} deleted successfully`);
            return true;
        } else {
            const errorData = await response.json();
            alert("삭제 실패: " + (errorData.detail || "서버 오류"));
            return false;
        }
    } catch (err) {
        console.error("Failed to delete map", err);
        alert("네트워크 오류로 삭제에 실패했습니다.");
        return false;
    }
}

// Rendering System
function render() {
    renderNodes();
    // Use requestAnimationFrame to let the DOM settle so we can get correct offsetWidth/Height
    requestAnimationFrame(renderEdges);
}

function renderNodes() {
    nodesLayer.innerHTML = ''; 
    mapData.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node ' + (node.id === 'root' || node.isRoot ? 'root-node' : '');
        if (node.id === activeNodeId) el.classList.add('selected');
        
        el.id = `node-${node.id}`;
        el.style.transform = `translate(${node.x}px, ${node.y}px)`;
        
        if (node.width) el.style.width = `${node.width}px`;
        if (node.height) el.style.height = `${node.height}px`;
        
        // Apply custom colors
        if (node.bgColor) el.style.backgroundColor = node.bgColor;
        if (node.textColor) el.style.color = node.textColor;
        
        if (node.color && !node.isRoot && node.id !== 'root') el.style.borderColor = node.color;
        
        // Inner Content
        let html = "";
        const titleStyle = node.titleSize ? `style="font-size: ${node.titleSize}px;"` : "";
        html += `<div class="node-title" ${titleStyle}>${node.text}</div>`;
        if (node.image) {
            html += `<img src="${node.image}" class="node-image" />`;
        }
        if (node.description) {
            const descStyle = node.descSize ? `style="font-size: ${node.descSize}px;"` : "";
            html += `<div class="node-desc" ${descStyle}>${node.description}</div>`;
        }
        html += `<div class="resize-handle"></div>`;
        el.innerHTML = html;
        
        // Image Interaction
        const img = el.querySelector('.node-image');
        if (img) {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                showNodeDetail(node);
            });
            img.addEventListener('dblclick', (e) => {
                e.stopPropagation();
            });
        }
        
        // Node events
        setupNodeEvents(el, node);
        
        nodesLayer.appendChild(el);
    });

    // Cache each node's rendered size so renderEdges never reads offsetWidth during drag
    requestAnimationFrame(() => {
        mapData.nodes.forEach(node => {
            const el = document.getElementById(`node-${node.id}`);
            if (el) {
                node._w = el.offsetWidth;
                node._h = el.offsetHeight;
            }
        });
        renderEdges();
    });
}

function renderEdges() {
    let svgContent = '';
    
    // Use cached _w/_h from mapData to avoid layout thrash during drag
    const nodeEls = {};
    mapData.nodes.forEach(n => {
        const w = n._w || (document.getElementById(`node-${n.id}`)?.offsetWidth) || 120;
        const h = n._h || (document.getElementById(`node-${n.id}`)?.offsetHeight) || 40;
        nodeEls[n.id] = { x: n.x, y: n.y, w, h };
    });

    mapData.nodes.forEach(node => {
        if (!node.parentId || !nodeEls[node.parentId] || !nodeEls[node.id]) return;
        
        const parent = nodeEls[node.parentId];
        const child = nodeEls[node.id];
        
        const px = parent.x + parent.w / 2;
        const py = parent.y + parent.h / 2;
        const cx = child.x + child.w / 2;
        const cy = child.y + child.h / 2;
        
        const intersect = getBoxMidpointSnap(px, py, cx, cy, child.w, child.h);
        const ix = intersect.x;
        const iy = intersect.y;
        
        const dx = ix - px;
        const dy = iy - py;
        
        let cp1x, cp1y, cp2x, cp2y;
        
        if (intersect.side === 'left' || intersect.side === 'right') {
            const dist = Math.abs(dx);
            cp1x = px + dist * 0.4;
            cp1y = py;
            cp2x = ix - dist * 0.4;
            cp2y = iy;
        } else {
            const dist = Math.abs(dy);
            cp1x = px;
            cp1y = py + (iy > py ? dist * 0.4 : -dist * 0.4);
            cp2x = ix;
            cp2y = iy - (iy > py ? dist * 0.4 : -dist * 0.4);
        }
        
        const pathData = `M ${px} ${py} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ix} ${iy}`;
        const isActive = activeNodeId === String(node.id) || activeNodeId === String(node.parentId);
        svgContent += `<path class="edge-path ${isActive ? 'active' : ''}" d="${pathData}" marker-end="url(#arrowhead)" />`;
    });
    
    edgesLayer.innerHTML = svgContent;
}

function showNodeDetail(node) {
    const modal = document.getElementById('node-detail-modal');
    const panel = document.getElementById('detail-panel');
    const titleEl = document.getElementById('detail-title');
    const desc = document.getElementById('detail-desc');
    const imgContainer = document.getElementById('detail-image-container');
    const img = document.getElementById('detail-img');
    
    if (!modal || !panel) return;
    
    titleEl.innerText = node.text;
    desc.innerText = node.description || "No description available.";
    
    if (node.image) {
        img.src = node.image;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }
    
    // Reset panel to centered position on each open (at first)
    // Or just keep last position if user prefers? Usually reset is cleaner for UX.
    panel.style.left = '50%';
    panel.style.top = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.width = '560px'; // Initial standard width
    panel.style.height = 'auto'; // Auto height to fit content

    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Force display for visibility
    setTimeout(() => modal.classList.add('visible'), 10);
}

function setupNodeDetailLogic() {
    const modal = document.getElementById('node-detail-modal');
    const panel = document.getElementById('detail-panel');
    const dragHeader = document.getElementById('detail-drag-header');
    const closeBtn = document.getElementById('close-detail');

    if (!modal || !panel || !dragHeader) return;

    // ── Close Listener ──
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeNodeDetail();
    };

    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) closeNodeDetail();
    });

    // ── Drag to Move (Header) ──
    let isDraggingPanel = false;
    let dragStartX, dragStartY, panelStartLeft, panelStartTop;

    const onDragStart = (e) => {
        if (e.target.closest('.close-btn')) return;
        e.preventDefault();
        isDraggingPanel = true;

        const rect = panel.getBoundingClientRect();
        panel.style.transform = 'none'; // Lock from transform to absolute px
        panel.style.left = rect.left + 'px';
        panel.style.top  = rect.top  + 'px';

        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panelStartLeft = rect.left;
        panelStartTop  = rect.top;

        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    };

    const onDragMove = (e) => {
        if (!isDraggingPanel) return;
        panel.style.left = (panelStartLeft + e.clientX - dragStartX) + 'px';
        panel.style.top  = (panelStartTop  + e.clientY - dragStartY) + 'px';
    };

    const onDragEnd = () => {
        isDraggingPanel = false;
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
    };

    dragHeader.addEventListener('mousedown', onDragStart);

    // ── 8-Direction Resize ──
    const handles = panel.querySelectorAll('.detail-resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const dir = handle.dataset.dir;
            const startX = e.clientX;
            const startY = e.clientY;
            const rect = panel.getBoundingClientRect();

            panel.style.transform = 'none';
            panel.style.left   = rect.left + 'px';
            panel.style.top    = rect.top  + 'px';

            const startW = rect.width;
            const startH = rect.height;
            const startLeft = rect.left;
            const startTop  = rect.top;

            const MIN_W = 320, MIN_H = 240;

            const onResizeMove = (me) => {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;

                let newW = startW, newH = startH;
                let newLeft = startLeft, newTop = startTop;

                if (dir.includes('e')) newW = Math.max(MIN_W, startW + dx);
                if (dir.includes('s')) newH = Math.max(MIN_H, startH + dy);
                if (dir.includes('w')) {
                    newW = Math.max(MIN_W, startW - dx);
                    if (newW > MIN_W) newLeft = startLeft + dx;
                }
                if (dir.includes('n')) {
                    newH = Math.max(MIN_H, startH - dy);
                    if (newH > MIN_H) newTop = startTop + dy;
                }

                panel.style.width  = newW + 'px';
                panel.style.height = newH + 'px';
                panel.style.left   = newLeft + 'px';
                panel.style.top    = newTop  + 'px';
            };

            const onResizeEnd = () => {
                window.removeEventListener('mousemove', onResizeMove);
                window.removeEventListener('mouseup', onResizeEnd);
            };

            window.addEventListener('mousemove', onResizeMove);
            window.addEventListener('mouseup', onResizeEnd);
        });
    });
}

function closeNodeDetail() {
    const modal = document.getElementById('node-detail-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }, 300);
    }
}

function getBoxMidpointSnap(px, py, cx, cy, w, h) {
    const dx = cx - px;
    const dy = cy - py;
    const halfW = w / 2;
    const halfH = h / 2;

    const slope = dy / dx;
    const boxSlope = halfH / halfW;

    if (Math.abs(slope) <= boxSlope) {
        // Closest to Left or Right side midpoints
        return {
            x: dx > 0 ? cx - halfW : cx + halfW,
            y: cy,
            side: dx > 0 ? 'left' : 'right'
        };
    } else {
        // Closest to Top or Bottom side midpoints
        return {
            x: cx,
            y: dy > 0 ? cy - halfH : cy + halfH,
            side: dy > 0 ? 'top' : 'bottom'
        };
    }
}

function updateNodePosition(nodeId, x, y) {
    const node = mapData.nodes.find(n => n.id === nodeId);
    if (node) {
        node.x = x;
        node.y = y;
        const el = document.getElementById(`node-${nodeId}`);
        if(el) {
            el.style.transform = `translate(${x}px, ${y}px)`;
            renderEdges(); // Update lines continuously
        }
    }
}


function setupNodeEvents(el, node) {
    let isDragging = false;
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let initialNodeX = 0;
    let initialNodeY = 0;
    let initialWidth = 0;
    let initialHeight = 0;

    const resizeHandle = el.querySelector('.resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            initialWidth = node.width || el.offsetWidth;
            initialHeight = node.height || el.offsetHeight;
            
            window.addEventListener('mousemove', onResize);
            window.addEventListener('mouseup', stopResize);
        });
    }

    const onResize = (e) => {
        if (!isResizing) return;
        const dx = (e.clientX - startX) / transform.scale;
        const dy = (e.clientY - startY) / transform.scale;
        
        node.width = Math.max(100, initialWidth + dx);
        node.height = Math.max(50, initialHeight + dy);
        
        el.style.width = `${node.width}px`;
        el.style.height = `${node.height}px`;

        // Keep cache in sync so renderEdges doesn't fall back to DOM reads
        node._w = node.width;
        node._h = node.height;
        renderEdges();
    };

    const stopResize = () => {
        isResizing = false;
        window.removeEventListener('mousemove', onResize);
        window.removeEventListener('mouseup', stopResize);
        saveStatus.innerText = "Unsaved changes";
    };

    el.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // prevent panning
        if (e.button !== 0) return; // only left click
        
        // Selection
        selectNode(node.id);
        
        // Start dragging
        isDragging = true;
        draggedNodeId = node.id; // Set the globally dragged node ID
        startX = e.clientX;
        startY = e.clientY;
        initialNodeX = node.x;
        initialNodeY = node.y;
        
        // Make sure it doesn't trigger drag events natively
        e.preventDefault();
        
        el.style.cursor = 'grabbing';
        el.style.zIndex = '1000';

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', stopDrag); // Use stopDrag for mouseup
    });

    // Move globally on window to catch fast mouse movements
    const moveHandler = (e) => {
        if (!isDragging) return;
        
        // Account for scale
        const dx = (e.clientX - startX) / transform.scale;
        const dy = (e.clientY - startY) / transform.scale;
        
        // Update node position directly
        const nodeToDrag = mapData.nodes.find(n => n.id === draggedNodeId);
        if (nodeToDrag) {
            nodeToDrag.x = initialNodeX + dx;
            nodeToDrag.y = initialNodeY + dy;
            
            // Reparenting: Check for potential parents under the mouse
            checkPotentialParent(nodeToDrag, e.clientX, e.clientY);
            
            // Update the visual position and re-render edges
            const elToDrag = document.getElementById(`node-${draggedNodeId}`);
            if (elToDrag) {
                elToDrag.style.transform = `translate(${nodeToDrag.x}px, ${nodeToDrag.y}px)`;
            }
            renderEdges();
        }
    };

    const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        el.style.cursor = 'grab';
        el.style.zIndex = '';
        
        if (draggedNodeId && potentialParentId !== null) {
            reparent(draggedNodeId, potentialParentId);
        }
        
        draggedNodeId = null;
        potentialParentId = null;
        
        // Remove all highlights
        document.querySelectorAll('.node').forEach(n => n.classList.remove('node-drop-target'));

        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', stopDrag);
        
        saveStatus.innerText = "Unsaved changes";
    };

    // Double click to edit
    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openEditor(node, el);
    });
}

function checkPotentialParent(draggedNode, mouseX, mouseY) {
    potentialParentId = null;
    document.querySelectorAll('.node').forEach(el => el.classList.remove('node-drop-target'));

    const elements = document.elementsFromPoint(mouseX, mouseY);
    // Find a node that is not the dragged node itself
    const targetEl = elements.find(el => el.classList.contains('node') && el.id !== `node-${draggedNode.id}`);
    
    if (targetEl) {
        const targetId = targetEl.id.replace('node-', '');
        
        // Validation: Target must not be the node itself or a descendant
        if (isValidParent(draggedNode.id, targetId)) {
            potentialParentId = targetId;
            targetEl.classList.add('node-drop-target');
        }
    }
}

function isValidParent(nodeId, targetParentId) {
    if (String(nodeId) === String(targetParentId)) return false;
    
    // Check if targetParentId is a descendant of nodeId
    let isDescendant = false;
    function check(id) {
        const children = mapData.nodes.filter(n => String(n.parentId) === String(id));
        children.forEach(c => {
            if (String(c.id) === String(targetParentId)) isDescendant = true;
            check(c.id);
        });
    }
    check(nodeId);
    
    return !isDescendant;
}

function reparent(nodeId, newParentId) {
    const node = mapData.nodes.find(n => String(n.id) === String(nodeId));
    if (node && String(node.parentId) !== String(newParentId)) {
        node.parentId = isNaN(newParentId) ? newParentId : parseInt(newParentId);
        render(); // Full re-render to update tree structure
        saveStatus.innerText = "Unsaved changes";
    }
}

function selectNode(nodeId) {
    if (activeNodeId === nodeId) return;
    
    if (activeNodeId) {
        const prev = document.getElementById(`node-${activeNodeId}`);
        if (prev) prev.classList.remove('selected');
    }
    
    activeNodeId = nodeId;
    
    if (activeNodeId) {
        const current = document.getElementById(`node-${activeNodeId}`);
        if (current) current.classList.add('selected');
        
        // Disable delete/sibling for root in guide
        const node = mapData.nodes.find(n => n.id === activeNodeId);
        if (node && (node.id === 'root' || node.isRoot)) {
            guideDelete.style.opacity = '0.4';
            guideDelete.style.pointerEvents = 'none';
            guideSibling.style.opacity = '0.4';
            guideSibling.style.pointerEvents = 'none';
        } else {
            guideDelete.style.opacity = '1';
            guideDelete.style.pointerEvents = 'auto';
            guideSibling.style.opacity = '1';
            guideSibling.style.pointerEvents = 'auto';
        }
    } else {
        // Reset guide state
        guideDelete.style.opacity = '1';
        guideDelete.style.pointerEvents = 'auto';
        guideSibling.style.opacity = '1';
        guideSibling.style.pointerEvents = 'auto';
    }
    
    renderEdges(); 
}

function openEditor(node, el) {
    const editBgColor = document.getElementById('edit-bg-color');
    const editTextColor = document.getElementById('edit-text-color');
    const editImageFile = document.getElementById('edit-image-file');
    const btnUploadImage = document.getElementById('btn-upload-image');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const btnRemoveImage = document.getElementById('btn-remove-image');

    let currentImageData = node.image || null;

    editTitle.value = node.text;
    editDesc.value = node.description || "";
    if (editBgColor) editBgColor.value = node.bgColor || "#1e293b";
    if (editTextColor) editTextColor.value = node.textColor || "#ffffff";
    
    const editTitleSize = document.getElementById('edit-title-size');
    const editDescSize = document.getElementById('edit-desc-size');
    if (editTitleSize) editTitleSize.value = node.titleSize || 16;
    if (editDescSize) editDescSize.value = node.descSize || 12;
    
    // Image Preview Setup
    const updatePreview = (data) => {
        currentImageData = data;
        if (data) {
            imagePreview.src = data;
            previewContainer.classList.remove('hidden');
            btnUploadImage.classList.add('hidden');
        } else {
            imagePreview.src = "";
            previewContainer.classList.add('hidden');
            btnUploadImage.classList.remove('hidden');
        }
    };
    updatePreview(currentImageData);

    editorWrapper.setAttribute('style', 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; z-index: 1000 !important;');
    editorWrapper.classList.remove('hidden');
    editorWrapper.classList.add('visible');
    
    editTitle.focus();
    editTitle.select();

    // Image Upload Events
    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => updatePreview(e.target.result);
        reader.readAsDataURL(file);
    };

    btnUploadImage.onclick = () => editImageFile.click();
    editImageFile.onchange = (e) => handleFile(e.target.files[0]);
    btnRemoveImage.onclick = () => updatePreview(null);

    // Paste Support
    const onPaste = (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                handleFile(items[i].getAsFile());
                break;
            }
        }
    };
    window.addEventListener('paste', onPaste);
    
    const saveAndClose = () => {
        if (!editorWrapper.classList.contains('visible')) return;
        
        node.text = editTitle.value.trim() || "New Node";
        node.description = editDesc.value.trim();
        if (editBgColor) node.bgColor = editBgColor.value;
        if (editTextColor) node.textColor = editTextColor.value;
        
        const editTitleSize = document.getElementById('edit-title-size');
        const editDescSize = document.getElementById('edit-desc-size');
        if (editTitleSize) node.titleSize = parseInt(editTitleSize.value) || 16;
        if (editDescSize) node.descSize = parseInt(editDescSize.value) || 12;
        
        node.image = currentImageData;
        
        window.removeEventListener('paste', onPaste);
        editorWrapper.setAttribute('style', 'display: none !important;');
        editorWrapper.classList.remove('visible');
        setTimeout(() => editorWrapper.classList.add('hidden'), 300);
        
        // Clean up events
        editorWrapper.onmousedown = null;
        btnEditorSave.onclick = null;
        btnEditorCancel.onclick = null;
        
        // Synchronization with Map Title removed (requested by user)

        render();
        saveStatus.innerText = "Unsaved changes";
    };
    
    const cancelAndClose = () => {
        editorWrapper.setAttribute('style', 'display: none !important;');
        editorWrapper.classList.remove('visible');
        setTimeout(() => editorWrapper.classList.add('hidden'), 300);
        
        editorWrapper.onmousedown = null;
        btnEditorSave.onclick = null;
        btnEditorCancel.onclick = null;
        
        workspace.focus();
    };

    // Global listeners for the editor wrapper action buttons
    btnEditorSave.onclick = (e) => {
        e.stopPropagation();
        saveAndClose();
    };

    btnEditorCancel.onclick = (e) => {
        e.stopPropagation();
        cancelAndClose();
    };

    editorWrapper.onmousedown = (e) => {
        if (e.target === editorWrapper) cancelAndClose(); // background click cancels
    };
    
    // Tab trapping inside editor: cycle through focusable elements
    editorWrapper.onkeydown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();

            // Collect all visible focusable elements inside editor
            const container = editorWrapper.querySelector('.editor-container');
            if (!container) return;
            const focusables = Array.from(
                container.querySelectorAll('input:not(.hidden):not([type="file"]), textarea, button:not(.hidden), select')
            ).filter(el => !el.closest('.hidden') && el.offsetParent !== null);

            if (focusables.length === 0) return;

            const currentIndex = focusables.indexOf(document.activeElement);
            let nextIndex;
            if (e.shiftKey) {
                nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
            }
            focusables[nextIndex].focus();
        }

        // Enter on a button → click it
        if (e.key === 'Enter' && document.activeElement.tagName === 'BUTTON') {
            e.preventDefault();
            e.stopPropagation();
            document.activeElement.click();
        }

        // Escape → cancel
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelAndClose();
        }
    };
}

// Workspace Panning
function setupEventListeners() {
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    workspace.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node')) return; // Ignore nodes
        
        // Deselect
        selectNode(null);
        
        isPanning = true;
        startPanX = e.clientX - transform.x;
        startPanY = e.clientY - transform.y;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        transform.x = e.clientX - startPanX;
        transform.y = e.clientY - startPanY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
    });

    workspace.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        
        let newScale = transform.scale * Math.exp(delta);
        newScale = Math.min(Math.max(0.1, newScale), 3);
        
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const ratio = newScale / transform.scale;
        transform.x = mouseX - (mouseX - transform.x) * ratio;
        transform.y = mouseY - (mouseY - transform.y) * ratio;
        transform.scale = newScale;
        
        updateTransform();
    }, { passive: false });
    
    zoomInBtn.addEventListener('click', () => zoomBy(1.2));
    zoomOutBtn.addEventListener('click', () => zoomBy(0.8));
    centerBtn.addEventListener('click', () => {
        transform.x = window.innerWidth / 2;
        transform.y = window.innerHeight / 2;
        transform.scale = 1;
        updateTransform();
    });
    
    saveBtn.addEventListener('click', saveMapData);
    
    document.getElementById('capture-btn').addEventListener('click', captureScreen);
    
    // Side Guide Events
    guideChild.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeNodeId) createChildNode(activeNodeId);
    });
    
    guideSibling.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeNodeId) createSiblingNode(activeNodeId);
    });
    
    guideDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeNodeId) deleteNode(activeNodeId);
    });


    // Export Data Logic
    exportBtn.addEventListener('click', () => {
        jsonDisplay.innerText = JSON.stringify(mapData, null, 2);
        dataModal.classList.remove('hidden');
        setTimeout(() => dataModal.classList.add('visible'), 10);
    });

    closeModal.addEventListener('click', () => {
        dataModal.classList.remove('visible');
        setTimeout(() => dataModal.classList.add('hidden'), 300);
    });

    // Close modal on background click
    dataModal.addEventListener('mousedown', (e) => {
        if (e.target === dataModal) {
            dataModal.classList.remove('visible');
            setTimeout(() => dataModal.classList.add('hidden'), 300);
        }
    });

    copyJsonBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(jsonDisplay.innerText).then(() => {
            const originalText = copyJsonBtn.innerText;
            copyJsonBtn.innerText = "Copied!";
            setTimeout(() => copyJsonBtn.innerText = originalText, 2000);
        });
    });

    // Landing Page Listeners
    btnCreateNew.addEventListener('click', createNewMap);
    btnBackToList.addEventListener('click', () => {
        showLanding();
    });

    // Map Info Editor Listeners
    btnEditMapInfo.addEventListener('click', () => {
        // Robust fetch
        const editor = document.getElementById('map-info-editor');
        const titleInput = document.getElementById('map-edit-title');
        const descInput = document.getElementById('map-edit-desc');

        if (!editor || !titleInput) return;

        titleInput.value = currentMapTitle;
        descInput.value = currentMapDesc;
        
        editor.setAttribute('style', 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; z-index: 5000 !important;');
        editor.classList.remove('hidden');
        editor.classList.add('visible');
    });

    btnMapInfoSave.addEventListener('click', () => {
        const titleInput = document.getElementById('map-edit-title');
        const descInput = document.getElementById('map-edit-desc');
        const editor = document.getElementById('map-info-editor');

        if (!titleInput || !editor) return;

        currentMapTitle = titleInput.value.trim() || "Untitled Mind Map";
        currentMapDesc = descInput.value.trim();
        currentMapTitleEl.innerText = currentMapTitle;
        
        // Synchronization with Root Node removed (requested by user)

        editor.setAttribute('style', 'display: none !important;');
        editor.classList.remove('visible');
        setTimeout(() => editor.classList.add('hidden'), 300);
        saveStatus.innerText = "Unsaved changes";
        render();
    });

    btnMapInfoCancel.addEventListener('click', () => {
        const editor = document.getElementById('map-info-editor');
        if (editor) {
            editor.setAttribute('style', 'display: none !important;');
            editor.classList.remove('visible');
            setTimeout(() => editor.classList.add('hidden'), 300);
        }
    });

    mapInfoEditor.onmousedown = (e) => {
        if (e.target === mapInfoEditor) {
            mapInfoEditor.setAttribute('style', 'display: none !important;');
            mapInfoEditor.classList.remove('visible');
            setTimeout(() => mapInfoEditor.classList.add('hidden'), 300);
        }
    };

    // Theme Switch (Sync all theme selects)
    document.querySelectorAll('.theme-select-common').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const theme = e.target.value;
            applyTheme(theme);
            saveThemeSetting(theme);
            
            // Sync other selects
            document.querySelectorAll('.theme-select-common').forEach(other => {
                if (other !== sel) other.value = theme;
            });
        });
    });


    // View Toggle Listeners
    btnViewGrid.addEventListener('click', () => {
        currentListViewMode = 'grid';
        btnViewGrid.classList.add('active');
        btnViewTable.classList.remove('active');
        loadMapsList();
    });

    btnViewTable.addEventListener('click', () => {
        currentListViewMode = 'table';
        btnViewTable.classList.add('active');
        btnViewGrid.classList.remove('active');
        loadMapsList();
    });

    setupNodeDetailLogic();
}

function zoomBy(factor) {
    let newScale = transform.scale * factor;
    newScale = Math.min(Math.max(0.1, newScale), 3);
    
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    
    const ratio = newScale / transform.scale;
    transform.x = cx - (cx - transform.x) * ratio;
    transform.y = cy - (cy - transform.y) * ratio;
    transform.scale = newScale;
    
    updateTransform();
}

function updateTransform() {
    const transformStr = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
    canvas.style.transform = transformStr;
    edgesLayer.style.transform = transformStr;
    
    zoomLevelTxt.innerText = `${Math.round(transform.scale * 100)}%`;
    document.body.style.backgroundPosition = `${transform.x}px ${transform.y}px`;
    document.body.style.backgroundSize = `${20 * transform.scale}px ${20 * transform.scale}px`;
}

// Keyboard shortcuts for navigation and editing
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        const lightboxOverlay = document.getElementById('image-lightbox');
        
        // Global Hotkeys
        if (e.key === 'Escape') {
            if (editorWrapper.classList.contains('visible')) {
               editorWrapper.classList.remove('visible');
               setTimeout(() => editorWrapper.classList.add('hidden'), 300);
            }
            closeDeleteConfirm();
            closeNodeDetail();
        }

        // Ctrl+S — Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveMapData();
            return;
        }

        // Ignore if any modal is open or focus is inside a form element
        const isModalOpen = editorWrapper.classList.contains('visible') || 
            dataModal.classList.contains('visible') || 
            deleteConfirmModal.classList.contains('visible') ||
            !document.getElementById('map-info-editor')?.classList.contains('hidden') ||
            !document.getElementById('node-detail-modal')?.classList.contains('hidden');
        const isFormFocused = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName);

        if (isModalOpen || isFormFocused) {
            return;
        }
        
        // ── Tab: Navigate between nodes ──
        if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigateNodes(e.shiftKey ? -1 : 1);
            return;
        }

        // ── Insert: Add Child Node (no editor popup) ──
        if (e.key === 'Insert') {
            e.preventDefault();
            if (activeNodeId) createChildNode(activeNodeId);
            return;
        }

        if (!activeNodeId) return;

        // ── Enter: Open editor for active node ──
        if (e.key === 'Enter' && !e.ctrlKey) {
            e.preventDefault();
            const node = mapData.nodes.find(n => n.id === activeNodeId);
            const el = document.getElementById(`node-${activeNodeId}`);
            if (node && el) openEditor(node, el);
            return;
        }

        // ── Ctrl+Enter: Add Sibling ──
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            createSiblingNode(activeNodeId);
            return;
        }

        // ── Arrow Keys: Move active node ──
        const MOVE_STEP = e.shiftKey ? 50 : 10;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const node = mapData.nodes.find(n => n.id === activeNodeId);
            if (!node) return;

            if (e.key === 'ArrowUp')    node.y -= MOVE_STEP;
            if (e.key === 'ArrowDown')  node.y += MOVE_STEP;
            if (e.key === 'ArrowLeft')  node.x -= MOVE_STEP;
            if (e.key === 'ArrowRight') node.x += MOVE_STEP;

            const el = document.getElementById(`node-${activeNodeId}`);
            if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;
            renderEdges();
            saveStatus.innerText = "Unsaved changes";
            return;
        }

        // ── Delete ──
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteNode(activeNodeId);
            return;
        }

        // ── +/- : Resize active node ──
        const RESIZE_STEP = e.shiftKey ? 50 : 20;
        if (e.key === '+' || e.key === '=' || e.key === 'Add') {
            e.preventDefault();
            const node = mapData.nodes.find(n => n.id === activeNodeId);
            const el = document.getElementById(`node-${activeNodeId}`);
            if (!node || !el) return;
            node.width  = (node.width  || node._w || el.offsetWidth)  + RESIZE_STEP;
            node.height = (node.height || node._h || el.offsetHeight) + RESIZE_STEP;
            node._w = node.width;
            node._h = node.height;
            el.style.width  = node.width  + 'px';
            el.style.height = node.height + 'px';
            renderEdges();
            saveStatus.innerText = "Unsaved changes";
            return;
        }
        if (e.key === '-' || e.key === 'Subtract') {
            e.preventDefault();
            const node = mapData.nodes.find(n => n.id === activeNodeId);
            const el = document.getElementById(`node-${activeNodeId}`);
            if (!node || !el) return;
            node.width  = Math.max(100, (node.width  || node._w || el.offsetWidth)  - RESIZE_STEP);
            node.height = Math.max(40,  (node.height || node._h || el.offsetHeight) - RESIZE_STEP);
            node._w = node.width;
            node._h = node.height;
            el.style.width  = node.width  + 'px';
            el.style.height = node.height + 'px';
            renderEdges();
            saveStatus.innerText = "Unsaved changes";
            return;
        }
    });
}

// Navigate between nodes in order (Tab / Shift+Tab)
function navigateNodes(direction) {
    if (!mapData.nodes || mapData.nodes.length === 0) return;

    // Build a flat ordered list: root first, then by parentId depth
    const ordered = buildNodeOrder();
    if (ordered.length === 0) return;

    let currentIdx = ordered.findIndex(n => n.id === activeNodeId);
    if (currentIdx === -1) {
        // Select root or first node
        selectNode(ordered[0].id);
        return;
    }

    let nextIdx = currentIdx + direction;
    if (nextIdx < 0) nextIdx = ordered.length - 1;
    if (nextIdx >= ordered.length) nextIdx = 0;
    selectNode(ordered[nextIdx].id);

    // Scroll the selected node into view if possible
    const el = document.getElementById(`node-${ordered[nextIdx].id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Build node order: root → children (BFS)
function buildNodeOrder() {
    const result = [];
    const rootNode = mapData.nodes.find(n => n.id === 'root' || n.isRoot);
    if (!rootNode) return mapData.nodes;

    const queue = [rootNode];
    const visited = new Set();

    while (queue.length > 0) {
        const node = queue.shift();
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        result.push(node);
        // Find children sorted by y then x
        const children = mapData.nodes
            .filter(n => n.parentId === node.id)
            .sort((a, b) => a.y - b.y || a.x - b.x);
        queue.push(...children);
    }

    // Add any orphans
    mapData.nodes.forEach(n => {
        if (!visited.has(n.id)) result.push(n);
    });

    return result;
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function createChildNode(parentId) {
    const parentNode = mapData.nodes.find(n => n.id === parentId);
    if (!parentNode) return;
    
    // Place it to the right
    const newNode = {
        id: generateId(),
        parentId: parentId,
        text: "New Node",
        x: parentNode.x + 250,
        y: parentNode.y,
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
    };
    
    mapData.nodes.push(newNode);
    render();
    selectNode(newNode.id);
    saveStatus.innerText = "Unsaved changes";
}

function createSiblingNode(nodeId) {
    const currentNode = mapData.nodes.find(n => n.id === nodeId);
    if (!currentNode || !currentNode.parentId) return;
    
    // Place it below
    const newNode = {
        id: generateId(),
        parentId: currentNode.parentId,
        text: "New Node",
        x: currentNode.x,
        y: currentNode.y + 100,
        color: currentNode.color
    };
    
    mapData.nodes.push(newNode);
    render();
    selectNode(newNode.id);
    saveStatus.innerText = "Unsaved changes";
}

function deleteNode(nodeId) {
    const node = mapData.nodes.find(n => n.id === nodeId);
    if (!node || node.id === 'root' || node.isRoot) return; // don't delete root
    
    // Recursive delete helper to delete all children
    const deleteRecursive = (idToDelete) => {
        // Find children
        const children = mapData.nodes.filter(n => n.parentId === idToDelete);
        children.forEach(c => deleteRecursive(c.id));
        // Remove node
        mapData.nodes = mapData.nodes.filter(n => n.id !== idToDelete);
    };
    
    deleteRecursive(nodeId);
    activeNodeId = null; // deselect
    render();
    saveStatus.innerText = "Unsaved changes";
}

async function captureScreen() {
    const saveStatus = document.getElementById('save-status');
    const originalText = saveStatus.innerText;
    saveStatus.innerText = "Capturing...";
    
    try {
        if (typeof domtoimage === 'undefined') {
            throw new Error("dom-to-image library not loaded");
        }
        
        const workspace = document.getElementById('workspace');
        
        // dom-to-image is better for SVG
        const dataUrl = await domtoimage.toPng(workspace, {
            bgcolor: getComputedStyle(document.body).backgroundColor,
            style: {
                transform: 'none', // Reset preview transform if any, but usually handled by clone
            }
        });
        
        const link = document.createElement('a');
        link.download = `${currentMapTitle || 'mindmap'}.png`;
        link.href = dataUrl;
        link.click();
        
        saveStatus.innerText = "Captured!";
        setTimeout(() => saveStatus.innerText = originalText, 2000);
    } catch (err) {
        console.error("Capture failed", err);
        saveStatus.innerText = "Capture failed";
    }
}

// Fire init when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
