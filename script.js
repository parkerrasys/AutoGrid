let points = [];
let undoStack = [];
let redoStack = [];
let canvas, ctx;
const GRID_SIZE = 6;
let TILE_SIZE = Math.min(window.innerWidth, window.innerHeight) / (GRID_SIZE + 2);
let recentPaths = [];

// Load recent paths from localStorage
if (localStorage.getItem('recentPaths')) {
  recentPaths = JSON.parse(localStorage.getItem('recentPaths'));
  updateRecentPathsDropdown();
}

function initGrid() {
  canvas = document.getElementById('grid');
  ctx = canvas.getContext('2d');

  canvas.width = GRID_SIZE * TILE_SIZE;
  canvas.height = GRID_SIZE * TILE_SIZE;

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', (e) => {
    handleMouseMove(e);
    updatePreviewPoint(e);
  });
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', () => {
    handleMouseUp();
    previewPoint = null;
    drawGrid();
  });
  canvas.addEventListener('click', handleGridClick);
  drawGrid();
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw preview point and line if exists

  // Function to check if a point is a lookAt point
  const isLookAtPoint = (index) => {
    if (index === 0) return false; // Starting point
    const prevPoints = points.slice(0, index).filter(p => p.type !== 'lookAt');
    return points[index].type === 'lookAt' && prevPoints.length > 0;
  };
  if (previewPoint && !isDragging) {
    const { x, y } = gridToCanvas(previewPoint.x, previewPoint.y);

    // Draw preview line if there are points
    if (points.length > 0) {
      const lastNonLookAtPoint = [...points].reverse().find(p => p.type !== 'lookAt') || points[points.length - 1];
      const lastCanvas = gridToCanvas(lastNonLookAtPoint.x, lastNonLookAtPoint.y);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 191, 255, 0.5)';
      ctx.moveTo(lastCanvas.x, lastCanvas.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Draw preview point
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 191, 255, 0.5)';
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw grid lines
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE_SIZE, 0);
    ctx.lineTo(i * TILE_SIZE, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * TILE_SIZE);
    ctx.lineTo(canvas.width, i * TILE_SIZE);
    ctx.stroke();
  }

  // Draw points and path
  if (points.length > 0) {
    // Draw path
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    let { x, y } = gridToCanvas(points[0].x, points[0].y);
    ctx.moveTo(x, y);

    for (let i = 1; i < points.length; i++) {
      let { x, y } = gridToCanvas(points[i].x, points[i].y);
      if (points[i].type === 'lookAt') {
        // Draw light purple line to lookAt point
        ctx.stroke(); // End current red line
        ctx.beginPath();
        ctx.strokeStyle = '#e6b3ff'; // Light purple
        let prevPoint = gridToCanvas(points[i-1].x, points[i-1].y);
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Continue red line from previous non-lookAt point
        ctx.beginPath();
        ctx.strokeStyle = 'red';
        ctx.moveTo(prevPoint.x, prevPoint.y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw points
    points.forEach((point, index) => {
      let { x, y } = gridToCanvas(point.x, point.y);
      ctx.beginPath();
      if (index === 0) {
        ctx.fillStyle = 'green'; // Starting point
      } else if (point.type === 'lookAt') {
        ctx.fillStyle = '#e6b3ff'; // Light purple for lookAt points
      } else {
        ctx.fillStyle = 'red'; // Regular points
      }
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// Converts canvas coordinates to the new grid system
function canvasToGrid(x, y) {
  return {
    x: Math.round(((x / TILE_SIZE) - 0.5) * 4) / 4,
    y: Math.round(((GRID_SIZE - (y / TILE_SIZE)) - 0.5) * 4) / 4
  };
}

let previewPoint = null;

function updatePreviewPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  previewPoint = canvasToGrid(x, y);
  drawGrid();
}

// Converts grid coordinates back to canvas drawing positions
function gridToCanvas(x, y) {
  return {
    x: (x + 0.5) * TILE_SIZE,
    y: (GRID_SIZE - (y + 0.5)) * TILE_SIZE
  };
}

function handleGridClick(e) {
  if (justDragged) return;
  
  // Close any open context menu
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  let { x: gridX, y: gridY } = canvasToGrid(x, y);
  addPoint(gridX, gridY);
}

function addPoint(x, y) {
  undoStack.push([...points]);
  redoStack = [];
  points.push({ x, y });
  updatePointsList();
  drawGrid();

  const pathName = document.getElementById('pathName').textContent;
  addToRecentPaths(pathName, [...points]);
}

let isDragging = false;
let draggedPointIndex = null;
let justDragged = false;

function updatePointsList() {
  const list = document.getElementById('pointsList');
  list.innerHTML = points.map((point, i) => `
    <div class="point-item" draggable="true" data-index="${i}">
      Point ${i}: (
      <input type="number" min="-.5" max="5.5" step="0.25" value="${point.x}" onchange="updatePoint(${i}, 'x', this.value)">
      ,
      <input type="number" min="-.5" max="5.5" step="0.25" value="${point.y}" onchange="updatePoint(${i}, 'y', this.value)">
      )
    </div>
  `).join('');
}

let startDragPos = null;

let contextMenu = null;

function handleMouseDown(e) {
  if (e.button === 2) { // Right click
    e.preventDefault();
    showContextMenu(e);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  startDragPos = { x, y };

  // Check if clicked near any point
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const canvasPoint = gridToCanvas(point.x, point.y);
    const distance = Math.sqrt(
      Math.pow(x - canvasPoint.x, 2) + 
      Math.pow(y - canvasPoint.y, 2)
    );

    if (distance < 10) {
      draggedPointIndex = i;
      canvas.style.cursor = 'grabbing';
      return;
    }
  }
}

function showContextMenu(e) {
  e.preventDefault(); // Prevent default context menu

  const canvasRect = canvas.getBoundingClientRect();
  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;

  // Remove existing context menu if any
  if (contextMenu) {
    contextMenu.remove();
  }

  // Create context menu
  contextMenu = document.createElement('div');
  contextMenu.style.cssText = `
    position: absolute;
    background: #454545;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    padding: 5px 0;
    z-index: 1000;
    left: ${e.clientX}px;
    top: ${e.clientY}px;
  `;

  let nearPoint = false;
  let pointIndex = -1;
  let nearLine = false;
  let lineStartIndex = -1;

  // Check if near a point (increased selection range to 20 pixels)
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const canvasPoint = gridToCanvas(point.x, point.y);
    const distance = Math.sqrt(
      Math.pow(x - canvasPoint.x, 2) + 
      Math.pow(y - canvasPoint.y, 2)
    );
    if (distance < 20) {
      nearPoint = true;
      pointIndex = i;
      break;
    }
  }

  // Check if near a line segment
  if (!nearPoint && points.length > 1) {
    for (let i = 0; i < points.length - 1; i++) {
      const start = gridToCanvas(points[i].x, points[i].y);
      const end = gridToCanvas(points[i + 1].x, points[i + 1].y);

      // Calculate distance from point to line segment
      const A = x - start.x;
      const B = y - start.y;
      const C = end.x - start.x;
      const D = end.y - start.y;

      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = -1;

      if (len_sq !== 0) {
        param = dot / len_sq;
      }

      let xx, yy;

      if (param < 0) {
        xx = start.x;
        yy = start.y;
      } else if (param > 1) {
        xx = end.x;
        yy = end.y;
      } else {
        xx = start.x + param * C;
        yy = start.y + param * D;
      }

      const distance = Math.sqrt(Math.pow(x - xx, 2) + Math.pow(y - yy, 2));

      if (distance < 15) {
        nearLine = true;
        lineStartIndex = i;
        break;
      }
    }
  }

  // Add menu items
  const menuItems = [];

  if (nearPoint) {
    menuItems.push({
      text: 'Delete Point',
      action: () => {
        undoStack.push([...points]);
        redoStack = [];
        points.splice(pointIndex, 1);
        updatePointsList();
        drawGrid();
        const pathName = document.getElementById('pathName').textContent;
        addToRecentPaths(pathName, [...points]);
      }
    },
    {
      text: 'Delete Points After',
      action: () => {
        undoStack.push([...points]);
        redoStack = [];
        points.splice(pointIndex + 1);
        updatePointsList();
        drawGrid();
        const pathName = document.getElementById('pathName').textContent;
        addToRecentPaths(pathName, [...points]);
      }
    });
  } else if (nearLine) {
    const gridPos = canvasToGrid(x, y);
    menuItems.push({
      text: 'Add Point Here',
      action: () => {
        undoStack.push([...points]);
        redoStack = [];
        points.splice(lineStartIndex + 1, 0, { x: gridPos.x, y: gridPos.y });
        updatePointsList();
        drawGrid();
      }
    });
  } else {
    // Add general options when clicking elsewhere on the grid
    const gridPos = canvasToGrid(x, y);
    menuItems.push(
      {
        text: 'Add Look At Point',
        action: () => {
          undoStack.push([...points]);
          redoStack = [];
          points.push({ x: gridPos.x, y: gridPos.y, type: 'lookAt' });
          updatePointsList();
          drawGrid();
        }
      },
      {
        text: 'Build Path',
        action: () => buildPath()
      },
      {
        text: 'Import Path',
        action: () => importPath()
      },
      {
        text: 'Export Path',
        action: () => exportPath()
      }
    );
  }

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.style.cssText = `
      padding: 5px 20px;
      cursor: pointer;
      color: white;
    `;
    menuItem.textContent = item.text;
    menuItem.onmouseover = () => menuItem.style.background = '#3498db';
    menuItem.onmouseout = () => menuItem.style.background = 'transparent';
    menuItem.oncontextmenu = (e) => e.preventDefault();
    menuItem.onclick = () => {
      item.action();
      contextMenu.remove();
      contextMenu = null;
    };
    contextMenu.appendChild(menuItem);
  });

  document.body.appendChild(contextMenu);

  // Keep menu open until explicitly closed
  document.addEventListener('click', function closeMenu(e) {
    if (contextMenu && !contextMenu.contains(e.target) && e.button !== 2) {
      contextMenu.remove();
      contextMenu = null;
      document.removeEventListener('click', closeMenu);
    }
  });
}

function handleMouseMove(e) {
  if (!draggedPointIndex !== null) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if we've moved enough to consider it a drag
    if (!isDragging && startDragPos) {
      const distance = Math.sqrt(
        Math.pow(x - startDragPos.x, 2) + 
        Math.pow(y - startDragPos.y, 2)
      );
      if (distance > 5) {
        isDragging = true;
      }
    }
  }

  if (!isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const gridPos = canvasToGrid(x, y);

  // Update point position
  points[draggedPointIndex].x = Math.max(-0.5, Math.min(5.5, gridPos.x));
  points[draggedPointIndex].y = Math.max(-0.5, Math.min(5.5, gridPos.y));

  updatePointsList();
  drawGrid();
}

function handleMouseUp(e) {
  if (draggedPointIndex !== null) {
    if (isDragging) {
      // If we dragged, save the state
      undoStack.push([...points.map(p => ({...p}))]);
      redoStack = [];
      justDragged = true;
      const pathName = document.getElementById('pathName').textContent;
      addToRecentPaths(pathName, [...points]); // Save after drag
      setTimeout(() => {
        justDragged = false;
      }, 100);
    } else {
      // If we just clicked (no drag), add a new point
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let { x: gridX, y: gridY } = canvasToGrid(x, y);
      addPoint(gridX, gridY);
    }
  }

  isDragging = false;
  draggedPointIndex = null;
  startDragPos = null;
  canvas.style.cursor = 'default';
}

function updatePoint(index, coord, value) {
  undoStack.push([...points]);
  redoStack = [];
  points[index][coord] = parseFloat(value);
  drawGrid();
  const pathName = document.getElementById('pathName').textContent;
  addToRecentPaths(pathName, [...points]);
}

function undo() {
  if (undoStack.length > 0) {
    redoStack.push([...points]);
    points = undoStack.pop();
    updatePointsList();
    drawGrid();
  }
}

function redo() {
  if (redoStack.length > 0) {
    undoStack.push([...points]);
    points = redoStack.pop();
    updatePointsList();
    drawGrid();
  }
}

function createNewPath() {
  let newName = 'Untitled';
  let counter = 1;
  while (recentPaths.some(p => p.name === newName)) {
    newName = `Untitled ${counter}`;
    counter++;
  }

  points = [];
  undoStack = [];
  redoStack = [];
  updatePointsList();
  drawGrid();

  document.getElementById('pathName').textContent = newName;
  addToRecentPaths(newName, []);
  updateRecentPathsDropdown();
}

// Initialize grid when page loads
function handleResize() {
  TILE_SIZE = Math.min(window.innerWidth, window.innerHeight) / (GRID_SIZE + 2);
  canvas.width = GRID_SIZE * TILE_SIZE;
  canvas.height = GRID_SIZE * TILE_SIZE;
  drawGrid();
}

function changeTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  drawGrid(); // Redraw grid with new theme colors
}

window.onload = function() {
  initGrid();
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark'; // Default dark theme
  document.getElementById('themeSelector').value = savedTheme;
  changeTheme(savedTheme);
  // Prevent context menu everywhere in the document
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
      }
      closePopup();
    }
  });

  // Add keyboard shortcut for undo
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  });
  if (recentPaths.length > 0) {
    const recentPath = recentPaths[0];
    document.getElementById('pathName').textContent = recentPath.name;
    points = [...recentPath.points];
    updatePointsList();
    drawGrid();
  } else {
    createNewPath();
  }
  updateRecentPathsDropdown();
};

function editPathName() {
  const pathSpan = document.getElementById('pathName');
  const currentName = pathSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName === 'Untitled' ? '' : currentName;
  input.className = 'path-name-input';
  input.placeholder = 'Untitled';

  input.onblur = function() {
    const oldName = pathSpan.textContent;
    const newName = input.value.trim() || 'Untitled';
    pathSpan.textContent = newName;
    pathSpan.style.display = '';
    input.remove();
    updateRecentPathName(oldName, newName);
    if (points.length > 0) {
      addToRecentPaths(newName, [...points]);
    }
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      input.blur();
    }
  };

  pathSpan.style.display = 'none';
  pathSpan.parentNode.insertBefore(input, pathSpan);
  input.focus();
}

function updateRecentPathsDropdown() {
  const dropdown = document.getElementById('recentPaths');
  const currentPathName = document.getElementById('pathName').textContent;
  dropdown.innerHTML = '';
  recentPaths.forEach(path => {
    const option = document.createElement('option');
    option.textContent = path.name;
    option.value = path.name;
    dropdown.appendChild(option);
  });
  dropdown.value = currentPathName;
}

function deleteSelectedPath() {
  const dropdown = document.getElementById('recentPaths');
  const selectedPath = dropdown.value;
  if (!selectedPath) return;

  const overlay = createOverlay();
  document.body.appendChild(overlay);

  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #454545;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #3c3c3c;
    z-index: 1000;
    text-align: center;
  `;

  popup.innerHTML = `
    <p style="margin-bottom: 20px;">Are you sure you want to delete the path "${selectedPath}"?</p>
    <button onclick="confirmDeletePath('${selectedPath}')" style="margin-right: 10px;">Yes</button>
    <button onclick="closePopup()">No</button>
    <div style="margin-top: 10px; color: #999; font-size: 12px;">Press ESC to cancel</div>
  `;

  document.body.appendChild(popup);
  overlay.addEventListener('click', closePopup);
}

function confirmDeletePath(pathName) {
  const currentPath = document.getElementById('pathName').textContent;
  recentPaths = recentPaths.filter(p => p.name !== pathName);
  localStorage.setItem('recentPaths', JSON.stringify(recentPaths));

  if (currentPath === pathName) {
    if (recentPaths.length > 0) {
      const newPath = recentPaths[0];
      document.getElementById('pathName').textContent = newPath.name;
      points = [...newPath.points];
    } else {
      document.getElementById('pathName').textContent = 'Untitled';
      points = [];
      addToRecentPaths('Untitled', []);
    }
    updatePointsList();
    drawGrid();
  }
  updateRecentPathsDropdown();
  closePopup();
}

function addToRecentPaths(name, pathPoints) {
  if (recentPaths.some(p => p.name === name && p !== recentPaths.find(p => p.name === document.getElementById('pathName').textContent))) {
    return;
  }
  const path = { name, points: pathPoints };
  recentPaths = recentPaths.filter(p => p.name !== name);
  recentPaths.unshift(path);
  if (recentPaths.length > 10) recentPaths.pop();
  localStorage.setItem('recentPaths', JSON.stringify(recentPaths));
  updateRecentPathsDropdown();
}

function updateRecentPathName(oldName, newName) {
  const pathIndex = recentPaths.findIndex(p => p.name === oldName);
  if (pathIndex !== -1) {
    recentPaths[pathIndex].name = newName;
    localStorage.setItem('recentPaths', JSON.stringify(recentPaths));
    updateRecentPathsDropdown();
  }
}

function loadRecentPath(name) {
  if (!name) return;
  const path = recentPaths.find(p => p.name === name);
  if (path) {
    points = [...path.points];
    document.getElementById('pathName').textContent = path.name;
    updatePointsList();
    drawGrid();
    updateRecentPathsDropdown();
  }
}

function exportPath() {
  const pathName = document.getElementById('pathName').textContent;
  const fileName = `${pathName === 'Untitled' ? 'AutoGrid_Path' : pathName}.txt`;
  const code = points.map((p, i) => {
    if (p.type === 'lookAt') return `lookAt(${p.x}, ${p.y});`;
    return i === 0 ? `setStarting(${p.x}, ${p.y});` : `moveTo(${p.x}, ${p.y});`;
  }).join('\n');
  addToRecentPaths(pathName, [...points]);
  const blob = new Blob([code], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

function importPath() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = e => {
    const file = e.target.files[0];
    const pathName = file.name.replace(/\.[^/.]+$/, "");
    document.getElementById('pathName').textContent = pathName;
    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target.result;
      points = text.split('\n')
        .map(line => {
          const moveMatch = line.match(/moveTo\((\d+\.?\d*),\s*(\d+\.?\d*)\)/);
          const lookMatch = line.match(/lookAt\((\d+\.?\d*),\s*(\d+\.?\d*)\)/);
          const startMatch = line.match(/setStarting\((\d+\.?\d*),\s*(\d+\.?\d*)\)/);
          
          if (moveMatch) {
            return { x: parseFloat(moveMatch[1]), y: parseFloat(moveMatch[2]) };
          } else if (lookMatch) {
            return { x: parseFloat(lookMatch[1]), y: parseFloat(lookMatch[2]), type: 'lookAt' };
          } else if (startMatch) {
            return { x: parseFloat(startMatch[1]), y: parseFloat(startMatch[2]) };
          }
          return null;
        })
        .filter(p => p !== null);
      updatePointsList();
      drawGrid();
      addToRecentPaths(pathName, [...points]);
    };
    reader.readAsText(file);
  };
  input.click();
}

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  `;
  return overlay;
}

function buildPath() {
  // Remove any existing popups
  const existingPopup = document.querySelector('.popup-overlay');
  if (existingPopup) {
    existingPopup.remove();
  }

  const pointCommands = points.map((p, index) => {
    if (index === 0) {
      return `  setStarting(${p.x}, ${p.y});`;
    } else if (p.type === 'lookAt') {
      return `  lookAt(${p.x}, ${p.y});`;
    } else {
      return `  moveTo(${p.x}, ${p.y});`;
    }
  });
  const code = `void autonomous(void) {\n${pointCommands.join('\n')}\n}`;

  const overlay = createOverlay();
  document.body.appendChild(overlay);

  const popup = document.createElement('div');
  popup.className = 'code-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #454545;
    padding: 20px;
    border-radius: 8px;
    border: 10px solid #3c3c3c;
    z-index: 1000;
    max-width: 80%;
    width: 250px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  const pre = document.createElement('pre');
  pre.style.cssText = `
    background: #1e1e1e;
    padding: 10px;
    border-radius: 4px;
    overflow: auto;
    margin: 10px 0;
    white-space: pre-wrap;
    flex: 1;
    max-height: calc(80vh - 100px);
  `;
  pre.textContent = code;

  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy Code';
  copyButton.onclick = () => {
    navigator.clipboard.writeText(code);
    copyButton.textContent = 'Copied!';
    setTimeout(() => copyButton.textContent = 'Copy Code', 2000);
  };

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.onclick = () => closePopup(); // Updated to close all popups

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; padding: 10px 0;';
  
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(closeButton);
  
  popup.appendChild(pre);
  popup.appendChild(buttonContainer);
  document.body.appendChild(popup);

  // Close popup when clicking outside
  overlay.addEventListener('click', closePopup);
}

// Function for Clear button
function clearCurrentPath() {
  const overlay = createOverlay();
  document.body.appendChild(overlay);

  // Create and style the confirmation popup
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #454545;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #3c3c3c;
    z-index: 1000;
    text-align: center;
  `;

  popup.innerHTML = `
    <p style="margin-bottom: 20px;">Are you sure you want to clear the current path?</p>
    <button onclick="confirmClear()" style="margin-right: 10px;">Yes</button>
    <button onclick="closePopup()">No</button>
    <div style="margin-top: 10px; color: #999; font-size: 12px;">Press ESC to cancel</div>
  `;

  document.body.appendChild(popup);

  // Close popup when clicking outside
  overlay.addEventListener('click', closePopup);
}

function closePopup() {
  const overlay = document.querySelector('.popup-overlay');
  const popup = document.querySelectorAll('.code-popup, div[style*="position: fixed"]');
  if (overlay) overlay.remove();
  popup.forEach(p => p.remove());
}



function confirmClear() {
  const currentName = document.getElementById('pathName').textContent;
  // Save current state to undo stack before clearing
  undoStack.push([...points]);
  redoStack = [];
  points = [];
  updatePointsList();
  drawGrid();
  addToRecentPaths(currentName, []);
  updateRecentPathsDropdown();
  closePopup();
}

// Function for New Path button
function clearPath() {
  createNewPath();
}