let points = [];
let undoStack = [];
let redoStack = [];
let canvas, ctx;
const GRID_SIZE = 6;
let TILE_SIZE = Math.min(window.innerWidth, window.innerHeight) / (GRID_SIZE + 2);
let recentPaths = [];

// Load recent paths from localStorage
if (localStorage.getItem("recentPaths")) {
    recentPaths = JSON.parse(localStorage.getItem("recentPaths"));
    updateRecentPathsDropdown();
}

function initGrid() {
    canvas = document.getElementById("grid");
    ctx = canvas.getContext("2d");
    
    // Hide loading immediately after grid is initialized
    const loadingElement = document.getElementById('gridLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }

    canvas.width = GRID_SIZE * TILE_SIZE;
    canvas.height = GRID_SIZE * TILE_SIZE;

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", (e) => {
        handleMouseMove(e);
        updatePreviewPoint(e);
    });
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", () => {
        handleMouseUp();
        previewPoint = null;
        drawGrid();
        const tooltip = document.querySelector(".no-path-tooltip");
        if (tooltip) tooltip.remove();
    });
    canvas.addEventListener("click", handleGridClick);
    drawGrid();
}

function drawGrid() {
    canvas.style.cursor = "crosshair";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw preview point and line if exists
    // Function to check if a point is a lookAt point
    const isLookAtPoint = (index) => {
        if (index === 0) return false; // Starting point
        const prevPoints = points.slice(0, index).filter((p) => p.type !== "lookAt");
        return points[index].type === "lookAt" && prevPoints.length > 0;
    };
    if (previewPoint && !isDragging) {
        const { x, y } = gridToCanvas(previewPoint.x, previewPoint.y);

        // Draw preview line if there are points
        if (points.length > 0) {
            const lastNonLookAtPoint = [...points].reverse().find((p) => p.type !== "lookAt") || points[points.length - 1];
            const lastCanvas = gridToCanvas(lastNonLookAtPoint.x, lastNonLookAtPoint.y);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(0, 191, 255, 0.5)";
            ctx.moveTo(lastCanvas.x, lastCanvas.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        // Draw preview point
        ctx.beginPath();
        ctx.fillStyle = "rgba(0, 191, 255, 0.5)";
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw grid lines
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border-color");
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
        ctx.strokeStyle = "red";
        let lastMovePoint = points[0];
        let { x, y } = gridToCanvas(lastMovePoint.x, lastMovePoint.y);
        ctx.moveTo(x, y);

        for (let i = 1; i < points.length; i++) {
            let { x, y } = gridToCanvas(points[i].x, points[i].y);
            if (points[i].type === "lookAt") {
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = "rgb(200, 89, 255)";
                let prevPoint = gridToCanvas(lastMovePoint.x, lastMovePoint.y);
                ctx.moveTo(prevPoint.x, prevPoint.y);
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = "red";
                ctx.moveTo(prevPoint.x, prevPoint.y);
            } else if (points[i].type === "reverse") {
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = "rgb(201, 97, 0)";
                let prevPoint = gridToCanvas(lastMovePoint.x, lastMovePoint.y);
                ctx.moveTo(prevPoint.x, prevPoint.y);
                ctx.lineTo(x, y);
                ctx.stroke();
                lastMovePoint = points[i];
                ctx.beginPath();
                ctx.strokeStyle = "red";
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
                lastMovePoint = points[i];
            }
        }
        ctx.stroke();

        // Draw points
        points.forEach((point, index) => {
            let { x, y } = gridToCanvas(point.x, point.y);
            
            // Check if this point is selected - draw gold outline
            if (window.selectedPoints && window.selectedPoints.has(index)) {
                ctx.beginPath();
                ctx.strokeStyle = "#FFD700"; // Gold color
                ctx.lineWidth = 3;
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1; // Reset line width
            }
            
            // Draw the point fill
            ctx.beginPath();
            if (index === 0) {
                ctx.fillStyle = "green"; // Starting point
            } else if (point.type === "lookAt") {
                ctx.fillStyle = "rgb(218, 145, 255)"; // Light purple for lookAt points
            } else if (point.type === "reverse"){
                ctx.fillStyle = "#ff8616"; // Reverse points (drive backwards to point)
            } else {
                ctx.fillStyle = "#ff534e"; // Default points (drive forwards to point)
            }
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// Converts canvas coordinates to the grid system
function canvasToGrid(x, y) {
    return {
        x: Math.round((x / TILE_SIZE - 0.5) * 4) / 4,
        y: Math.round((GRID_SIZE - y / TILE_SIZE - 0.5) * 4) / 4,
    };
}

let previewPoint = null;

function updatePreviewPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (document.getElementById("pathName").textContent === "No File") {
        const tooltip = createNoPathTooltip("No Path Selected");
        tooltip.style.display = "block";
        tooltip.style.left = e.clientX + 10 + "px";
        tooltip.style.top = e.clientY - tooltip.offsetHeight - 5 + "px";
    } else if (window.previewEnabled) {
        previewPoint = canvasToGrid(x, y);
    }
    drawGrid();
}

function createNoPathTooltip(message) {
    let tooltip = document.querySelector(".no-path-tooltip");
    if (tooltip) {
        tooltip.textContent = message;
        return tooltip;
    }

    tooltip = document.createElement("div");
    tooltip.className = "no-path-tooltip";
    tooltip.style.cssText = `
    position: fixed;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 1000;
    display: none;
  `;
    tooltip.textContent = message;
    document.body.appendChild(tooltip);
    return tooltip;
}

function updateTooltipPosition(element, tooltip) {
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + "px";
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + "px";
}

// Converts grid coordinates back to canvas drawing positions
function gridToCanvas(x, y) {
    return {
        x: (x + 0.5) * TILE_SIZE,
        y: (GRID_SIZE - (y + 0.5)) * TILE_SIZE,
    };
}

function handleGridClick(e) {
    if (justDragged || document.getElementById("pathName").textContent === "No File") return;
    if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let { x: gridX, y: gridY } = canvasToGrid(x, y);

    // Only check against the last point to prevent immediate stacking
    const lastPoint = points[points.length - 1];
    const isStackedOnLastPoint = lastPoint && lastPoint.x === gridX && lastPoint.y === gridY;

    if (!isStackedOnLastPoint) {
        addPoint(gridX, gridY);
    }
}

function addPoint(x, y) {
    undoStack.push(JSON.parse(JSON.stringify(points)));
    redoStack = [];
    points.push({ x, y });
    updatePointsList();
    drawGrid();
    updateSimulationButton();

    const pathName = document.getElementById("pathName").textContent;
    addToRecentPaths(pathName, [...points]);
}

let isDragging = false;
let draggedPointIndex = null;
let justDragged = false;
let startDragPos = null;
let originalPoints = null; // Store original points when starting a drag

function updatePointsList() {
    const list = document.getElementById("pointsList");
    list.innerHTML = points
        .map(
            (point, i) => `
    <div class="point-item" draggable="true" data-index="${i}">
      Point ${i}: (
      <input 
        style="border-radius: 8px;" 
        type="horizontal-number" 
        min="-.5" 
        max="5.5" 
        step="0.25" 
        value="${point.x}" 
        onchange="updatePoint(${i}, 'x', this.value)">
      ,
      <input 
        style="border-radius: 8px;" 
        type="vertical-number" 
        min="-.5" 
        max="5.5" 
        step="0.25" 
        value="${point.y}" 
        onchange="updatePoint(${i}, 'y', this.value)">
      )
    </div>
  `
        )
        .join("");

    // Add selected class style to document if not already added
    if (!document.getElementById('point-selection-style')) {
        const style = document.createElement('style');
        style.id = 'point-selection-style';
        style.textContent = `
            .point-item.selected {
                background-color:rgb(43, 43, 43);
                outline: 2px solid #3498db;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }

    // Store selected points and last selected index for range selection
    window.selectedPoints = new Set(); // Make it global so drawGrid can access it
    let lastSelectedIndex = -1;

    // Add click handlers for point selection
    const pointItems = list.querySelectorAll('.point-item');
    pointItems.forEach((item) => {
        item.addEventListener('click', (event) => {
            const index = parseInt(item.dataset.index);
            
            // Ctrl/Command key for individual selection toggling
            if (event.ctrlKey || event.metaKey) {
                if (window.selectedPoints.has(index)) {
                    window.selectedPoints.delete(index);
                    item.classList.remove('selected');
                } else {
                    window.selectedPoints.add(index);
                    item.classList.add('selected');
                    lastSelectedIndex = index;
                }
            } 
            // Shift key for range selection
            else if (event.shiftKey && lastSelectedIndex !== -1) {
                // Clear existing selection visually
                pointItems.forEach(p => p.classList.remove('selected'));
                
                // Determine range bounds
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);
                
                // Select all points in the range
                for (let i = start; i <= end; i++) {
                    window.selectedPoints.add(i);
                    pointItems[i].classList.add('selected');
                }
            } 
            // Normal click - select just this one
            else {
                pointItems.forEach(p => p.classList.remove('selected'));
                window.selectedPoints.clear();
                window.selectedPoints.add(index);
                item.classList.add('selected');
                lastSelectedIndex = index;
            }
            
            // Redraw grid to show selected points with gold outline
            drawGrid();
            
            // Prevent the event from affecting inputs
            event.stopPropagation();
        });
    });

    // Function to clear all selections
    function clearAllSelections() {
        pointItems.forEach(p => p.classList.remove('selected'));
        window.selectedPoints.clear();
        lastSelectedIndex = -1;
        drawGrid(); // Redraw grid to remove gold outlines
    }

        // Add keyboard event listener for delete key and escape key
        document.addEventListener('keydown', (event) => {
            // Delete key handling
            if (event.key === 'Delete' && window.selectedPoints.size > 0) {
                // Save current state to undo stack before deletion
                undoStack.push(JSON.parse(JSON.stringify(points)));
                redoStack = [];
                
                // Convert set to array and sort in descending order
                // to avoid index shifting during deletion
                const indicesToDelete = Array.from(window.selectedPoints).sort((a, b) => b - a);
                
                // Delete points
                indicesToDelete.forEach(index => {
                    points.splice(index, 1);
                });
                
                // Redraw everything
                window.selectedPoints.clear();
                lastSelectedIndex = -1;
                updatePointsList();
                drawGrid();
                const pathName = document.getElementById("pathName").textContent;
                addToRecentPaths(pathName, [...points]);
            }

        
        
        // Escape key handling - clear all selections
        if (event.key === 'Escape') {
            clearAllSelections();
        }
    });

    // scrolling to change values
    const vertical_inputs = list.querySelectorAll('input[type="vertical-number"]');
    vertical_inputs.forEach((input) => {
        input.addEventListener('wheel', (event) => {
            event.preventDefault();
            const step = parseFloat(input.step) || 1;
            let currentValue = parseFloat(input.value) || 0;

            if (event.deltaY < 0) {
                input.value = Math.min(currentValue + step, parseFloat(input.max) || Infinity);
            } else {
                input.value = Math.max(currentValue - step, parseFloat(input.min) || -Infinity);
            }
            input.dispatchEvent(new Event('change'));
        });
    });

    // scrolling to change values
    const horizontal_inputs = list.querySelectorAll('input[type="horizontal-number"]');
    horizontal_inputs.forEach((input) => {
        input.addEventListener('wheel', (event) => {
            event.preventDefault();
            const step = parseFloat(input.step) || 1;
            let currentValue = parseFloat(input.value) || 0;

            if (event.deltaY < 0) {
                input.value = Math.min(currentValue + step, parseFloat(input.max) || Infinity);
            } else {
                input.value = Math.max(currentValue - step, parseFloat(input.min) || -Infinity);
            }
            input.dispatchEvent(new Event('change'));
        });
        
        // Prevent input click events from triggering parent selection
        input.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    });
}

let contextMenu = null;

function handleMouseDown(e) {
    if (e.button === 2) {
        // Right click
        e.preventDefault();
        showContextMenu(e);
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    startDragPos = { x, y };

    // Check if clicked near any point - loop backward to find newest points first
    for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        const canvasPoint = gridToCanvas(point.x, point.y);
        const distance = Math.sqrt(Math.pow(x - canvasPoint.x, 2) + Math.pow(y - canvasPoint.y, 2));

        if (distance < 20) {
            draggedPointIndex = i;
            // Store a deep copy of the points array when starting to drag
            originalPoints = JSON.parse(JSON.stringify(points));
            return;
        }
    }
}

function showContextMenu(e) {
    e.preventDefault(); // Prevent default context menu

    // Check if there's no active path
    if (document.getElementById("pathName").textContent === "No File") {
        const tooltip = createNoPathTooltip("No Path Selected");
        tooltip.style.display = "block";
        tooltip.style.left = e.clientX + 10 + "px";
        tooltip.style.top = e.clientY - tooltip.offsetHeight - 5 + "px";
        return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    // Remove existing context menu if any
    if (contextMenu) {
        contextMenu.remove();
    }

    // Create context menu
    contextMenu = document.createElement("div");
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

    // Check if near a point - loop backward to find newest points first
    for (let i = points.length - 1; i >= 0; i--) {
        const point = points[i];
        const canvasPoint = gridToCanvas(point.x, point.y);
        const distance = Math.sqrt(Math.pow(x - canvasPoint.x, 2) + Math.pow(y - canvasPoint.y, 2));
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
        const lineLength = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        if (lineLength === 0) continue;
        const perpendicularDist = Math.abs((end.x - start.x) * (start.y - y) - (start.x - x) * (end.y - start.y)) / lineLength;
        const dotProduct = ((x - start.x) * (end.x - start.x) + (y - start.y) * (end.y - start.y)) / (lineLength * lineLength);
        if (dotProduct >= 0 && dotProduct <= 1 && perpendicularDist < 10) {
            nearLine = true;
            lineStartIndex = i;
            break;
        }
    }
}

// Add menu items
const menuItems = [];

if (nearPoint) {
    // Handle special case for starting point (first point in path)
    const isStartingPoint = pointIndex === 0;
    
    // Only show point type options if it's NOT the starting point
    if (!isStartingPoint) {
        // Define point types with their styles
        const pointTypes = [
            { name: "Default", color: "rgb(255, 213, 149)", value: "normal" },
            { name: "LookAt", color: "rgb(250, 96, 255)", value: "lookAt" },
            { name: "Reverse", color: "rgb(255, 140, 0)", value: "reverse" }, // Dark Orange for Reverse
        ];

        const displayPointType = points[pointIndex].type || "Default";
        const pointColor = points[pointIndex].type === "lookAt" ? "rgb(250, 96, 255)" : 
                          points[pointIndex].type === "reverse" ? "rgb(255, 140, 0)" : 
                          "rgb(255, 213, 149)";

        // Create point type submenu
        const typeMenuItem = document.createElement("div");
        typeMenuItem.style.cssText = `
            padding: 5px 20px;
            cursor: pointer;
            color: ${pointColor};
            position: relative;
        `;
        typeMenuItem.textContent = "Type: " + displayPointType;

        // Create the submenu container
        const typeSubmenu = document.createElement("div");
        typeSubmenu.style.cssText = `
            position: absolute;
            left: 100%;
            top: 0;
            background-color: #1a1a1a;
            border: 1px solid #444;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            display: none;
            z-index: 1001;
        `;

        // Add type options to submenu
        pointTypes.forEach(type => {
            const typeOption = document.createElement("div");
            typeOption.style.cssText = `
                padding: 5px 20px;
                cursor: pointer;
                color: ${type.color};
            `;
            typeOption.textContent = type.name;
            typeOption.onmouseover = () => (typeOption.style.background = "#2c2c2c");
            typeOption.onmouseout = () => (typeOption.style.background = "transparent");
            typeOption.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault(); // Prevent default behavior
                
                undoStack.push(JSON.parse(JSON.stringify(points)));
                redoStack = [];
                points[pointIndex].type = type.value === "normal" ? undefined : type.value;
                
                // Update display text and color
                typeMenuItem.textContent = "Type: " + type.name;
                typeMenuItem.style.color = type.color;
                
                updatePointsList();
                drawGrid();
                const pathName = document.getElementById("pathName").textContent;
                addToRecentPaths(pathName, [...points]);
                
                // Close the menu after making a selection
                if (contextMenu) {
                    contextMenu.remove();
                    contextMenu = null;
                }
            };
            typeSubmenu.appendChild(typeOption);
        });

        // Show submenu on hover
        typeMenuItem.onmouseover = () => {
            typeMenuItem.style.background = "#2c2c2c";
            typeSubmenu.style.display = "block";
        };
        typeMenuItem.appendChild(typeSubmenu);

        // Hide submenu when moving out of parent menu item and submenu
        const hideSubmenu = () => {
            if (typeSubmenu) typeSubmenu.style.display = "none";
            if (typeMenuItem) typeMenuItem.style.background = "transparent";
        };

        typeMenuItem.onmouseout = (e) => {
            // Prevent closing when hovering over the submenu
            if (!typeSubmenu.contains(e.relatedTarget) && e.relatedTarget !== typeSubmenu) {
                hideSubmenu();
            }
        };

        typeSubmenu.onmouseout = (e) => {
            // Check if we're moving out of the submenu completely
            if (!typeSubmenu.contains(e.relatedTarget) && e.relatedTarget !== typeMenuItem) {
                hideSubmenu();
            }
        };

        contextMenu.appendChild(typeMenuItem);
    }

    // Display text for starting point
    if (isStartingPoint) {
        const startingPointInfo = document.createElement("div");
        startingPointInfo.style.cssText = `
            padding: 5px 20px;
            color: rgb(0, 255, 0);
            font-style: italic;
        `;
        startingPointInfo.textContent = "Starting Point";
        contextMenu.appendChild(startingPointInfo);
    }

    // Add other point-related menu items (Delete Point, etc.)
    menuItems.push(
        {
            text: "Delete Point",
            action: () => {
                undoStack.push(JSON.parse(JSON.stringify(points)));
                redoStack = [];
                points.splice(pointIndex, 1);
                updatePointsList();
                drawGrid();
                updateSimulationButton();
                const pathName = document.getElementById("pathName").textContent;
                addToRecentPaths(pathName, [...points]);
            },
            style: "color:rgb(255, 68, 68);",
        },
        {
            text: "Delete Points Before",
            action: () => {
                undoStack.push(JSON.parse(JSON.stringify(points)));
                redoStack = [];
                points.splice(0, pointIndex);
                updatePointsList();
                drawGrid();
                updateSimulationButton();
                const pathName = document.getElementById("pathName").textContent;
                addToRecentPaths(pathName, [...points]);
            },
            style: "color:rgb(255, 68, 68);",
        },
        {
            text: "Delete Points After",
            action: () => {
                undoStack.push(JSON.parse(JSON.stringify(points)));
                redoStack = [];
                points.splice(pointIndex + 1);
                updatePointsList();
                drawGrid();
                updateSimulationButton();
                const pathName = document.getElementById("pathName").textContent;
                addToRecentPaths(pathName, [...points]);
            },
            style: "color:rgb(255, 68, 68);",
        }
    );
} else if (nearLine) {
    const gridPos = canvasToGrid(x, y);
    menuItems.push({
        text: "Add Point Here",
        action: () => {
            undoStack.push(JSON.parse(JSON.stringify(points)));
            redoStack = [];
            points.splice(lineStartIndex + 1, 0, { x: gridPos.x, y: gridPos.y });
            updatePointsList();
            drawGrid();
            updateSimulationButton();
        },
    });
} else {
    // Add general options when clicking elsewhere on the grid
    const gridPos = canvasToGrid(x, y);
    menuItems.push(
        {
            text: "Add lookAt Point",
            action: () => {
                undoStack.push(JSON.parse(JSON.stringify(points)));
                redoStack = [];
                points.push({ x: gridPos.x, y: gridPos.y, type: "lookAt" });
                updatePointsList();
                drawGrid();
                updateSimulationButton();
            },
            style: "color:rgb(250, 96, 255);",
        },
        {
            text: "Clear Path",
            action: () => clearCurrentPath(),
            style: "color:rgb(255, 122, 122);",
        },
        {
            text: "Toggle Preview",
            action: () => {
                window.previewEnabled = !window.previewEnabled;
                localStorage.setItem("previewEnabled", window.previewEnabled);
                if (!window.previewEnabled) {
                    previewPoint = null;
                    drawGrid();
                }
            },
            style: "color:rgb(0, 138, 230);",
        },
        {
            text: "Build Path",
            action: () => buildPath(),
        },
        {
            text: "Import Path",
            action: () => importSharePath(),
        },
        {
            text: "Export Path",
            action: () => exportPath(),
        },
        {
            text: "Share Path",
            action: () => sharePaths(),
        },
        {
            text: "Delete Path",
            action: () => deleteSelectedPath(),
            style: "color:rgb(255, 68, 68);",
        },
        {
            text: "Clear All Paths",
            action: () => clearAllRecentPaths(),
            style: "color:rgb(255, 68, 68);",
        }
    );
}

menuItems.forEach((item) => {
    const menuItem = document.createElement("div");
    if (item.style) {
        menuItem.style.cssText = `
            padding: 5px 20px;
            cursor: pointer;
            ${item.style}
        `;
    } else {
        menuItem.style.cssText = `
            padding: 5px 20px;
            cursor: pointer;
            color: white;
        `;
    }
    menuItem.textContent = item.text;
    menuItem.onmouseover = () => (menuItem.style.background = "#2c2c2c");
    menuItem.onmouseout = () => (menuItem.style.background = "transparent");
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
document.addEventListener("click", function closeMenu(e) {
    if (contextMenu && !contextMenu.contains(e.target) && e.button !== 2) {
        contextMenu.remove();
        contextMenu = null;
        document.removeEventListener("click", closeMenu);
    }
});
}

function handleMouseMove(e) {
    if (draggedPointIndex !== null) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if we've moved enough to consider it a drag
        if (!isDragging && startDragPos) {
            const distance = Math.sqrt(Math.pow(x - startDragPos.x, 2) + Math.pow(y - startDragPos.y, 2));
            if (distance > 5) {
                isDragging = true;
                canvas.style.cursor = "grab";
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
            // If we dragged, save the state to undo stack
            // Only save if there was an actual change
            if (originalPoints && JSON.stringify(originalPoints) !== JSON.stringify(points)) {
                undoStack.push(originalPoints);
                redoStack = [];
                
                // Save the updated path
                const pathName = document.getElementById("pathName").textContent;
                addToRecentPaths(pathName, JSON.parse(JSON.stringify(points))); // Save after drag
            }
            
            justDragged = true;
            setTimeout(() => {
                justDragged = false;
            }, 100);
        }
    }

    isDragging = false;
    draggedPointIndex = null;
    startDragPos = null;
    originalPoints = null;
    canvas.style.cursor = "default";
}

function updatePoint(index, coord, value) {
    const val = Math.min(Math.max(parseFloat(value) || 0, -0.5), 5.5);
    const input = event.target;
    input.value = val;
    undoStack.push([...points]);
    redoStack = [];
    points[index][coord] = val;
    drawGrid();
    updateSimulationButton();
    const pathName = document.getElementById("pathName").textContent;
    addToRecentPaths(pathName, [...points]);
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push([...points]);
        points = undoStack.pop();
        updatePointsList();
        drawGrid();
        updateSimulationButton();
        const pathName = document.getElementById("pathName").textContent;
        addToRecentPaths(pathName, [...points]);
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push([...points]);
        points = redoStack.pop();
        updatePointsList();
        drawGrid();
        updateSimulationButton();
        const pathName = document.getElementById("pathName").textContent;
        addToRecentPaths(pathName, [...points]);
    }
}

function createNewPath() {
    let newName = "Untitled";
    let counter = 1;
    while (recentPaths.some((p) => p.name === newName)) {
        newName = `Untitled ${counter}`;
        counter++;
    }

    points = [];
    undoStack = [];
    redoStack = [];
    updatePointsList();
    drawGrid();
    updateSimulationButton();

    const pathNameElement = document.getElementById("pathName");
    pathNameElement.textContent = newName;
    pathNameElement.style.cursor = "pointer";
    pathNameElement.onclick = editPathName;
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
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    drawGrid();
}

function updateRobotConfig() {
    const widthInput = document.getElementById("robotWidth");
    const lengthInput = document.getElementById("robotLength");

    let width = Math.min(Math.max(parseFloat(widthInput.value) || 5, 5), 18);
    let length = Math.min(Math.max(parseFloat(lengthInput.value) || 5, 5), 18);

    widthInput.value = width;
    lengthInput.value = length;

    drawRobotDiagram(width, length);
}

function drawRobotDiagram(robotWidth, robotLength) {
    const canvas = document.getElementById("robotDiagram");
    const ctx = canvas.getContext("2d");

    // Set canvas size
    canvas.width = 200;
    canvas.height = 200;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale (1 tile = 24 inches)
    const scale = canvas.width / (24 * 2); // Show 2 tiles width

    // Draw grid (2x2 tiles)
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border-color");
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let i = 0; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * (canvas.width / 2), 0);
        ctx.lineTo(i * (canvas.width / 2), canvas.height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * (canvas.height / 2));
        ctx.lineTo(canvas.width, i * (canvas.height / 2));
        ctx.stroke();
    }

    // Draw robot
    const robotWidthPx = robotWidth * scale;
    const robotLengthPx = robotLength * scale;

    // Center the robot
    const x = (canvas.width - robotWidthPx) / 2;
    const y = (canvas.height - robotLengthPx) / 2;

    // Draw robot rectangle
    ctx.fillStyle = "rgba(52, 152, 219, 0.5)";
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, robotWidthPx, robotLengthPx);
    ctx.strokeRect(x, y, robotWidthPx, robotLengthPx);

    // Draw direction indicator
    ctx.beginPath();
    ctx.moveTo(x + robotWidthPx / 2, y + robotLengthPx / 2);
    ctx.lineTo(x + robotWidthPx / 2, y + robotLengthPx / 4);
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(x + robotWidthPx / 2, y + robotLengthPx / 4);
    ctx.lineTo(x + robotWidthPx / 2 - 5, y + robotLengthPx / 4 + 10);
    ctx.lineTo(x + robotWidthPx / 2 + 5, y + robotLengthPx / 4 + 10);
    ctx.closePath();
    ctx.fillStyle = "#e74c3c";
    ctx.fill();
}

window.onload = function () {
    window.previewEnabled = localStorage.getItem("previewEnabled") !== "false";
    initGrid();
    updateRobotConfig();
    updateSimulationButton();

    // Add hover effect for simulation button
    const simButton = document.getElementById("simButton");
    simButton.addEventListener("mouseover", (e) => {
        if (points.length === 0 || document.getElementById("pathName").textContent === "No File") {
            const tooltip = createNoPathTooltip("No path to follow");
            tooltip.style.display = "block";
            updateTooltipPosition(simButton, tooltip);
        }
    });

    simButton.addEventListener("mouseleave", () => {
        const tooltip = document.querySelector(".no-path-tooltip");
        if (tooltip) tooltip.style.display = "none";
    });
    // Load saved theme
    const savedTheme = localStorage.getItem("theme") || "dark"; // Default dark theme
    document.getElementById("themeSelector").value = savedTheme;
    changeTheme(savedTheme);
    // Prevent context menu everywhere in the document
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", handleResize);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (contextMenu) {
                contextMenu.remove();
                contextMenu = null;
            }
            closePopup();
        }
    });

    // Add keyboard shortcut for undo
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "z") {
            e.preventDefault();
            undo();
        } else if (e.ctrlKey && e.key === "x") {
            e.preventDefault();
            redo();
        }
    });
    const pathNameElement = document.getElementById("pathName");
    if (recentPaths.length > 0) {
        const recentPath = recentPaths[0];
        pathNameElement.textContent = recentPath.name;
        pathNameElement.style.cursor = "pointer";
        pathNameElement.onclick = editPathName;
        points = [...recentPath.points];
        updatePointsList();
        drawGrid();
        updateSimulationButton();
    } else {
        pathNameElement.textContent = "No File";
        pathNameElement.style.cursor = "default";
        pathNameElement.onclick = null;
        points = [];
        updatePointsList();
        drawGrid();
        updateSimulationButton();
    }
    updateRecentPathsDropdown();
};

function editPathName() {
    const pathSpan = document.getElementById("pathName");
    if (pathSpan.textContent === "No File") return;
    const currentName = pathSpan.textContent;

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName === "Untitled" ? "" : currentName;
    input.className = "path-name-input";
    input.placeholder = "Untitled";

    input.onblur = function () {
        const oldName = pathSpan.textContent;
        const newName = input.value.trim() || "Untitled";
        pathSpan.textContent = newName;
        pathSpan.style.display = "";
        input.remove();
        updateRecentPathName(oldName, newName);
        if (points.length > 0) {
            addToRecentPaths(newName, [...points]);
        }
        updateSimulationButton();
    };

    input.onkeydown = function (e) {
        if (e.key === "Enter") {
            input.blur();
        }
    };

    pathSpan.style.display = "none";
    pathSpan.parentNode.insertBefore(input, pathSpan);
    input.focus();
}

function updateRecentPathsDropdown() {
    const dropdown = document.getElementById("recentPaths");
    const currentPathName = document.getElementById("pathName").textContent;
    dropdown.innerHTML = "";

    if (recentPaths.length === 0) {
        dropdown.innerHTML = '<option value="">No Recent Paths</option>';
        dropdown.disabled = true;
        return;
    }

    dropdown.disabled = false;
    recentPaths.forEach((path) => {
        const option = document.createElement("option");
        option.textContent = path.name;
        option.value = path.name;
        dropdown.appendChild(option);
    });
    dropdown.value = currentPathName !== "No File" ? currentPathName : "";

    if (recentPaths.length > 0) {
        const separator = document.createElement("option");
        separator.disabled = true;
        separator.textContent = "─────────────────";
        dropdown.appendChild(separator);

        const clearAllOption = document.createElement("option");
        clearAllOption.value = "CLEAR_ALL";
        clearAllOption.textContent = "Clear All Paths";
        clearAllOption.style.color = "#ff4444";
        // clearAllOption.style.textAlign = "center";
        dropdown.appendChild(clearAllOption);
    }
}

function deleteSelectedPath() {
    const dropdown = document.getElementById("recentPaths");
    const selectedPath = dropdown.value;
    if (!selectedPath) return;

    const overlay = createOverlay();
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
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
    <p style="margin-bottom: 20px;">THIS CAN'T BE UNDONE!!!!</p>
    <button onclick="confirmDeletePath('${selectedPath}')" style="margin-right: 10px;">Yes</button>
    <button onclick="closePopup()">No</button>
    <div style="margin-top: 10px; color: #999; font-size: 12px;">Press ESC to cancel</div>
  `;

    document.body.appendChild(popup);
    overlay.addEventListener("click", closePopup);
}

function confirmDeletePath(pathName) {
    const currentPath = document.getElementById("pathName").textContent;
    recentPaths = recentPaths.filter((p) => p.name !== pathName);
    localStorage.setItem("recentPaths", JSON.stringify(recentPaths));

    if (currentPath === pathName) {
        if (recentPaths.length > 0) {
            const newPath = recentPaths[0];
            document.getElementById("pathName").textContent = newPath.name;
            points = [...newPath.points];
        } else {
            const pathNameElement = document.getElementById("pathName");
            pathNameElement.textContent = "No File";
            pathNameElement.style.cursor = "default";
            pathNameElement.onclick = null;
            points = [];
        }
        updatePointsList();
        drawGrid();
        updateSimulationButton();
    }
    updateRecentPathsDropdown();
    closePopup();
}

function addToRecentPaths(name, pathPoints) {
    if (recentPaths.some((p) => p.name === name && p !== recentPaths.find((p) => p.name === document.getElementById("pathName").textContent))) {
        return;
    }
    const path = { name, points: pathPoints };
    recentPaths = recentPaths.filter((p) => p.name !== name);
    recentPaths.unshift(path);
    if (recentPaths.length > 1000) recentPaths.pop();
    localStorage.setItem("recentPaths", JSON.stringify(recentPaths));
    updateRecentPathsDropdown();
}

function updateRecentPathName(oldName, newName) {
    const pathIndex = recentPaths.findIndex((p) => p.name === oldName);
    if (pathIndex !== -1) {
        recentPaths[pathIndex].name = newName;
        localStorage.setItem("recentPaths", JSON.stringify(recentPaths));
        updateRecentPathsDropdown();
    }
}

function loadRecentPath(name) {
    if (!name) return;
    if (name === "CLEAR_ALL") {
        clearAllRecentPaths();
        return;
    }
    const path = recentPaths.find((p) => p.name === name);
    if (path) {
        points = [...path.points];
        const pathNameElement = document.getElementById("pathName");
        pathNameElement.textContent = path.name;
        pathNameElement.style.cursor = "pointer";
        pathNameElement.onclick = editPathName;
        updatePointsList();
        drawGrid();
        updateSimulationButton(); // Addedto update button state after loading
        updateRecentPathsDropdown();
    }
}

function showNotification(message) {
    const actionButtons = document.querySelector(".action-buttons");
    const notification = document.createElement("div");
    notification.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    margin-bottom: 10px;
    pointer-events: none;
    white-space: nowrap;
  `;
    notification.textContent = message;
    actionButtons.style.position = "relative";
    actionButtons.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function exportPath() {
    const pathName = document.getElementById("pathName").textContent;
    if (pathName === "No File" || points.length === 0) {
        return;
    }

    const fileName = `${pathName === "Untitled" ? "AutoGrid_Path" : pathName}.txt`;
    const code = points
        .map((p, i) => {
            if (p.type === "lookAt") return `lookAt(${p.x}, ${p.y});`;
            return i === 0 ? `setStarting(${p.x}, ${p.y});` : `moveTo(${p.x}, ${p.y});`;
        })
        .join("\n");
    addToRecentPaths(pathName, [...points]);
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    showNotification("Path exported successfully");
}

function importPath() {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
        const file = e.target.files[0];
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const text = event.target.result;
            
            // Apply the same naming logic as in handleImport
            let newName = baseName;
            let counter = 1;
            while (recentPaths.some((p) => p.name === newName)) {
                newName = `${baseName} (${counter})`;
                counter++;
            }
            
            document.getElementById("pathName").textContent = newName;
            document.getElementById("pathName").style.cursor = "pointer";
            document.getElementById("pathName").onclick = editPathName;
            
            points = text
                .split("\n")
                .map((line) => {
                    const moveMatch = line.match(/moveTo\((\d+\.?\d*),\s*(\d+\.?\d*)\)/);
                    const lookMatch = line.match(/lookAt\((\d+\.?\d*),\s*(\d+\.?\d*)\)/);
                    const startMatch = line.match(/setStarting\((\d+\.?\d*),\s*(\d+\.?\d*)\)/);

                    if (moveMatch) {
                        return { x: parseFloat(moveMatch[1]), y: parseFloat(moveMatch[2]) };
                    } else if (lookMatch) {
                        return { x: parseFloat(lookMatch[1]), y: parseFloat(lookMatch[2]), type: "lookAt" };
                    } else if (startMatch) {
                        return { x: parseFloat(startMatch[1]), y: parseFloat(startMatch[2]) };
                    }
                    return null;
                })
                .filter((p) => p !== null);
                
            updatePointsList();
            drawGrid();
            addToRecentPaths(newName, [...points]);
            updateSimulationButton();
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
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
    const existingPopup = document.querySelector(".popup-overlay");
    if (existingPopup) {
        existingPopup.remove();
    }

    if (document.getElementById("pathName").textContent === "No File" || points.length === 0) {
        return;
    }

    const pointCommands = points.map((p, index) => {
        if (index === 0) {
            return `  setStarting(${p.x}, ${p.y});`;
        } else if (p.type === "lookAt") {
            return `  lookAt(${p.x}, ${p.y});`;
        } else if (p.type === "reverse") {
            return `  reverseTo(${p.x}, ${p.y});`;
        } else {
            return `  moveTo(${p.x}, ${p.y});`;
        }
    });
    const code = `void autonomous(void) {\n${pointCommands.join("\n")}\n}`;

    const overlay = createOverlay();
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
    popup.className = "code-popup";
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

    const pre = document.createElement("pre");
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

    const copyButton = document.createElement("button");
    copyButton.textContent = "Copy Code";
    copyButton.onclick = () => {
        navigator.clipboard.writeText(code);
        copyButton.textContent = "Copied!";
        showNotification("Code copied to clipboard");
        setTimeout(() => (copyButton.textContent = "Copy Code"), 2000);
    };

    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.onclick = () => closePopup(); // Updated to close all popups

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "display: flex; flex-direction: column; gap: 10px; padding: 10px 0;";

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);

    popup.appendChild(pre);
    popup.appendChild(buttonContainer);
    document.body.appendChild(popup);

    // Close popup when clicking outside
    overlay.addEventListener("click", closePopup);
}

// Function for Clear button
function clearCurrentPath() {
    const overlay = createOverlay();
    document.body.appendChild(overlay);

    // Create and style the confirmation popup
    const popup = document.createElement("div");
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
    overlay.addEventListener("click", closePopup);
}

function closePopup() {
    const overlay = document.querySelector(".popup-overlay");
    const popup = document.querySelectorAll('.code-popup, div[style*="position: fixed"]');
    if (overlay) overlay.remove();
    popup.forEach((p) => p.remove());
}

function confirmClear() {
    const currentName = document.getElementById("pathName").textContent;
    // Save current state to undo stack before clearing
    undoStack.push([...points]);
    redoStack = [];
    points = [];
    updatePointsList();
    drawGrid();
    addToRecentPaths(currentName, []);
    updateRecentPathsDropdown();
    updateSimulationButton();
    closePopup();
}

// Function for New Path button
function clearPath() {
    createNewPath();
}

function generateShareCode() {
    return recentPaths
        .map((path) => {
            const encodedName = encodeURIComponent(path.name);
            const encodedPoints = path.points
                .map((p) => {
                    // Check for each point type and encode accordingly
                    let pointStr = `${p.x},${p.y}`;
                    if (p.type === "lookAt") {
                        pointStr += ",l"; // "l" for lookAt
                    } else if (p.type === "reverse") {
                        pointStr += ",r"; // "r" for reverse
                    }
                    return pointStr;
                })
                .join("|");
            return `${encodedName}:${encodedPoints}`;
        })
        .join(";");
}

function parsePaths(shareCode) {
    try {
        return shareCode.split(";").map((pathStr) => {
            const [name, pointsStr] = pathStr.split(":");
            const points = pointsStr.split("|").map((pointStr) => {
                const [x, y, type] = pointStr.split(",");
                return {
                    x: parseFloat(x),
                    y: parseFloat(y),
                    type: type === "l" ? "lookAt" : (type === "r" ? "reverse" : undefined),
                };
            });
            return {
                name: decodeURIComponent(name),
                points,
            };
        });
    } catch (e) {
        throw new Error("Invalid share code format");
    }
}


function handleImport() {
    const fileInput = document.getElementById("importFile");
    const codeInput = document.getElementById("importCode");
    const errorContainer = document.querySelector(".error-container");

    try {
        if (codeInput.value.trim()) {
            const newPaths = parsePaths(codeInput.value.trim());
            const wasEmpty = recentPaths.length === 0;

            newPaths.forEach((path) => {
                let newName = path.name;
                let counter = 1;
                while (recentPaths.some((p) => p.name === newName)) {
                    newName = `${path.name} (${counter})`;
                    counter++;
                }
                addToRecentPaths(newName, path.points);
            });

            // If there were no paths before import, set the first imported path
            if (wasEmpty && newPaths.length > 0) {
                const pathNameElement = document.getElementById("pathName");
                pathNameElement.textContent = recentPaths[0].name;
                pathNameElement.style.cursor = "pointer";
                pathNameElement.onclick = editPathName;
                points = [...recentPaths[0].points];
                updatePointsList();
                drawGrid();
            }
        }
        closePopup();
        updateSimulationButton(); // Update button after import
    } catch (e) {
        errorContainer.innerHTML = `<div style="color: #ff4444; text-align: center;">${e.message}</div>`;
        return;
    }
}

// Share Path Function
function sharePaths() {
    if (document.getElementById("pathName").textContent === "No File" || points.length === 0) {
        return;
    }

    const overlay = createOverlay();
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
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
    width: 400px;
  `;

    const shareCode = generateShareCode();

    popup.innerHTML = `
    <h3 style="margin-top: 0; color: #fff; text-align: center;">Share Paths</h3>
    <div style="margin: 20px 0;">
      <div style="background: #2c2c2c; padding: 15px; border-radius: 6px; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #fff;">Share Code:</p>
        <textarea id="shareCode" readonly style="width: 75%; height: 80px; background: #3c3c3c; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 8px; resize: none;">${shareCode}</textarea>
      </div>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button onclick="navigator.clipboard.writeText(document.getElementById('shareCode').value).then(() => {
    this.textContent = 'Copied!';
    showNotification('Share code copied to clipboard');
  }).catch(() => {})" style="background: #3498db;">Copy Code</button>
      <button onclick="closePopup()" style="background: #666;">Close</button>
    </div>
  `;

    document.body.appendChild(popup);
    overlay.addEventListener("click", closePopup);
}

// Share Code Import Function
function importSharePath() {
    const overlay = createOverlay();
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
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
    width: 400px;
  `;

    popup.innerHTML = `
    <h3 style="margin-top: 0; color: #fff; text-align: center;">Import Paths</h3>
    <div style="margin: 20px 0;">
      <div style="background: #2c2c2c; padding: 15px; border-radius: 6px;">
        <p style="margin: 0 0 10px 0; color: #fff;">Share Code:</p>
        <textarea id="importCode" placeholder="Paste share code here" style="width: calc(100% - 16px); height: 80px; background: #3c3c3c; border: 1px solid #555; border-radius: 4px; color: #fff; padding: 8px; resize: none; margin-right: 0;"></textarea>
      </div>
    </div>

    <div class="error-container" style="min-height: 30px; margin-top: 10px;"></div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
      <button onclick="closePopup()" style="background: #666;">Cancel</button>
      <button onclick="handleImport()">Import</button>
    </div>
  `;

    document.body.appendChild(popup);
    overlay.addEventListener("click", closePopup);
}

let isSimulationPaused = false;
let isSimulationLooping = false;
let currentSimulation = null;

function toggleSimulation() {
    isSimulationPaused = !isSimulationPaused;
    document.getElementById("pauseButton").textContent = isSimulationPaused ? "Resume" : "Pause";
}

function stopSimulation() {
    if (currentSimulation) {
        cancelAnimationFrame(currentSimulation);
        currentSimulation = null;
    }
    isSimulationPaused = false;
    document.getElementById("simButton").style.display = "inline-block";
    document.getElementById("pauseButton").style.display = "none";
    document.getElementById("stopButton").style.display = "none";

    // Remove all simulation overlays and tooltip
    const overlays = document.querySelectorAll(".simulation-overlay");
    const tooltip = document.querySelector(".simulation-tooltip");
    overlays.forEach((overlay) => overlay.remove());
    if (tooltip) tooltip.remove();

    // Reset position styles
    document.querySelector("header").style.position = "";
    document.querySelector(".left-sidebar").style.position = "";
    document.querySelector("main").style.position = "";
    document.querySelector(".grid-container").style.position = "";

    drawGrid();
}

function loopSimulation() {
    isSimulationLooping = !isSimulationLooping;
    document.getElementById("loopButton").textContent = `Loop: ${isSimulationLooping ? "On" : "Off"}`;
}

function simulatePath() {
    const simButton = document.getElementById("simButton");

    if (points.length === 0 || document.getElementById("pathName").textContent === "No File") {
        simButton.style.cursor = "not-allowed";
        simButton.style.opacity = "0.5";
        return;
    }

    document.getElementById("simButton").style.display = "none";
    document.getElementById("pauseButton").style.display = "inline-block";
    document.getElementById("stopButton").style.display = "inline-block";

    // Create simulation overlays
    const header = document.querySelector("header");
    const leftSidebar = document.querySelector(".left-sidebar");
    const gridContainer = document.querySelector(".grid-container");
    const mainElement = document.querySelector("main");
    const bodyElement = document.body;

    // Header overlay
    const headerOverlay = document.createElement("div");
    headerOverlay.className = "simulation-overlay";
    headerOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    cursor: not-allowed;
    `;
    header.style.position = "relative";
    header.appendChild(headerOverlay);

    // Left sidebar overlay
    const leftOverlay = document.createElement("div");
    leftOverlay.className = "simulation-overlay";
    leftOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    cursor: not-allowed;
    `;
    leftSidebar.style.position = "relative";
    leftSidebar.appendChild(leftOverlay);

    // Grid overlay
    const gridOverlay = document.createElement("div");
    gridOverlay.className = "simulation-overlay";
    gridOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    cursor: not-allowed;
    `;

    const tooltip = document.createElement("div");
    tooltip.className = "simulation-tooltip";
    tooltip.style.cssText = `
    display: none;
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 101;
    `;
    tooltip.textContent = "Stop the simulation to edit";

    document.addEventListener("mousemove", (e) => {
        tooltip.style.display = "block";
        tooltip.style.left = e.clientX + 10 + "px";
        tooltip.style.top = e.clientY + 10 + "px";
    });

    document.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });

    // Add overlay to main element but exclude right sidebar
    mainElement.style.position = "relative";
    const mainOverlay = document.createElement("div");
    mainOverlay.className = "simulation-overlay";
    mainOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 325px;
    bottom: 0;
    z-index: 100;
    cursor: not-allowed;
    `;
    mainElement.appendChild(mainOverlay);

    gridContainer.style.position = "relative";
    gridContainer.appendChild(gridOverlay);
    document.body.appendChild(tooltip);

    const robotWidth = parseFloat(document.getElementById("robotWidth").value);
    const robotLength = parseFloat(document.getElementById("robotLength").value);
    const moveSpeed = parseFloat(document.getElementById("moveSpeed").value) / 24; // Convert to tiles/second
    const turnSpeed = parseFloat(document.getElementById("turnSpeed").value); // Degrees/second
    const canvas = document.getElementById("grid");
    const ctx = canvas.getContext("2d");

    let currentPoint = 0;
    let robotX = points[0].x;
    let robotY = points[0].y;
    let robotAngle = 0;
    let targetAngle = 0;
    let isRotating = true;
    let isReversing = false; // Flag to track if robot is in reverse mode
    let progress = 0;
    let animationFrameId = null;
    let lastTime = performance.now();
    let currentReverseTarget = null; // Keep track of the current reverse target
    let movementAngle = 0; // Store the angle we're actually moving at

    function calculateAngle(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        // Calculate angle in degrees, with 0 degrees pointing up (north)
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        // Adjust angle so 0 degrees points up
        angle = (90 - angle + 360) % 360;
        // Normalize to [-180, 180] range
        if (angle > 180) angle -= 360;
        return angle;
    }

    function drawRobot(x, y, angle) {
        const { x: canvasX, y: canvasY } = gridToCanvas(x, y);
        // Scale robot dimensions (1 tile = 24 inches)
        const robotWidthPx = (robotWidth / 24) * TILE_SIZE;
        const robotLengthPx = (robotLength / 24) * TILE_SIZE;

        ctx.save();
        ctx.translate(canvasX, canvasY);
        ctx.rotate((angle * Math.PI) / 180);

        // Draw robot rectangle
        ctx.fillStyle = "rgba(52, 152, 219, 0.5)";
        ctx.strokeStyle = "#3498db";
        ctx.lineWidth = 2;
        ctx.fillRect(-robotWidthPx / 2, -robotLengthPx / 2, robotWidthPx, robotLengthPx);
        ctx.strokeRect(-robotWidthPx / 2, -robotLengthPx / 2, robotWidthPx, robotLengthPx);

        // Draw direction indicator - red if reversing, normal otherwise
        ctx.beginPath();
        ctx.moveTo(0, 0);
        if (isReversing) {
            // Draw indicator pointing to the back when reversing
            ctx.lineTo(0, robotLengthPx / 4);
            ctx.strokeStyle = "#e74c3c";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw arrow head for reversing
            ctx.beginPath();
            ctx.moveTo(-5, robotLengthPx / 4 - 10);
            ctx.lineTo(0, robotLengthPx / 4);
            ctx.lineTo(5, robotLengthPx / 4 - 10);
            ctx.closePath();
            ctx.fillStyle = "#e74c3c";
            ctx.fill();
        } else {
            // Standard forward indicator
            ctx.lineTo(0, -robotLengthPx / 4);
            ctx.strokeStyle = "#e74c3c";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw arrow head
            ctx.beginPath();
            ctx.moveTo(-5, -robotLengthPx / 4 + 10);
            ctx.lineTo(0, -robotLengthPx / 4);
            ctx.lineTo(5, -robotLengthPx / 4 + 10);
            ctx.closePath();
            ctx.fillStyle = "#e74c3c";
            ctx.fill();
        }

        ctx.restore();
    }

    function animate(currentTime) {
        if (currentPoint >= points.length - 1) return;

        if (isSimulationPaused) {
            lastTime = currentTime;
            currentSimulation = requestAnimationFrame(animate);
            return;
        }
        
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        const endPoint = points[currentPoint + 1];
        const startPoint = points[currentPoint];

        // Handle lookAt points
        if (endPoint.type === "lookAt") {
            if (isRotating) {
                // Find last moveTo point
                let lastMovePoint = [...points]
                    .slice(0, currentPoint + 1)
                    .reverse()
                    .find((p) => !p.type || p.type === "reverse");

                // Stay at last moveTo point while rotating
                robotX = lastMovePoint.x;
                robotY = lastMovePoint.y;

                // Rotate to look at the point
                targetAngle = calculateAngle(robotX, robotY, endPoint.x, endPoint.y);
                let angleDiff = targetAngle - robotAngle;

                while (angleDiff > 180) angleDiff -= 360;
                while (angleDiff < -180) angleDiff += 360;

                const rotationStep = turnSpeed * deltaTime;

                if (Math.abs(angleDiff) > rotationStep) {
                    robotAngle += Math.sign(angleDiff) * rotationStep;
                } else {
                    robotAngle = targetAngle;
                    isRotating = false;
                    // Wait before proceeding to next point
                    const lookAtPauseDuration = parseFloat(document.getElementById("lookAtPause").value) * 1000;
                    setTimeout(() => {
                        currentPoint++;
                        isRotating = true;
                    }, lookAtPauseDuration);
                }
            }
            drawGrid();
            drawRobot(robotX, robotY, robotAngle);
            currentSimulation = requestAnimationFrame(animate);
            return;
        }

        // Handle reverse points
        if (endPoint.type === "reverse") {
            // Store the current reverse target if we haven't done so already
            if (!currentReverseTarget) {
                currentReverseTarget = endPoint;
            }
            
            if (isRotating) {
                // For reverse points, we need to rotate the robot to face AWAY from the point
                // Calculate angle in the opposite direction
                const directAngle = calculateAngle(robotX, robotY, endPoint.x, endPoint.y);
                // Add 180 degrees to make it face in the opposite direction
                targetAngle = (directAngle + 180) % 360;
                if (targetAngle > 180) targetAngle -= 360;
                
                let angleDiff = targetAngle - robotAngle;
                while (angleDiff > 180) angleDiff -= 360;
                while (angleDiff < -180) angleDiff += 360;

                const rotationStep = turnSpeed * deltaTime;

                if (Math.abs(angleDiff) > rotationStep) {
                    robotAngle += Math.sign(angleDiff) * rotationStep;
                } else {
                    robotAngle = targetAngle;
                    isRotating = false;
                    isReversing = true; // Set reversing mode as we start moving backwards
                    // Remember the movement angle for the entire movement
                    movementAngle = robotAngle;
                }
            } else {
                // Moving backwards to reverse point
                const lastMovePoint = [...points]
                    .slice(0, currentPoint + 1)
                    .reverse()
                    .find((p) => !p.type || p.type === "reverse");
                    
                const dx = endPoint.x - lastMovePoint.x;
                const dy = endPoint.y - lastMovePoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Adjust progress based on actual distance
                progress += (moveSpeed * deltaTime) / (distance || 1);

                if (progress >= 1) {
                    // When we reach the reverse point, it becomes our new position
                    robotX = endPoint.x;
                    robotY = endPoint.y;
                    progress = 0;
                    currentPoint++;
                    isRotating = true;
                    // Clear the current reverse target since we've finished with it
                    currentReverseTarget = null;
                } else {
                    robotX = lastMovePoint.x + dx * progress;
                    robotY = lastMovePoint.y + dy * progress;
                    // Keep using the same angle during movement - no change
                    robotAngle = movementAngle;
                }
            }
            
            drawGrid();
            drawRobot(robotX, robotY, robotAngle);
            currentSimulation = requestAnimationFrame(animate);
            return;
        }

        // Standard rotation for normal movement
        if (isRotating) {
            // If we were in reverse mode and now moving to a normal point,
            // we should exit reverse mode
            if (isReversing) {
                isReversing = false;
                currentReverseTarget = null;
            }

            // Find next point for movement
            let nextMovePoint = endPoint;

            targetAngle = calculateAngle(robotX, robotY, nextMovePoint.x, nextMovePoint.y);
            let angleDiff = targetAngle - robotAngle;

            while (angleDiff > 180) angleDiff -= 360;
            while (angleDiff < -180) angleDiff += 360;

            const rotationStep = turnSpeed * deltaTime;

            if (Math.abs(angleDiff) > rotationStep) {
                robotAngle += Math.sign(angleDiff) * rotationStep;
            } else {
                robotAngle = targetAngle;
                isRotating = false;
                // Remember the movement angle for the entire movement
                movementAngle = robotAngle;
            }
        } else {
            // Normal movement to the next point
            if (endPoint) {
                // Get the last actual position point (moveTo or reverse)
                const lastMovePoint = [...points]
                    .slice(0, currentPoint + 1)
                    .reverse()
                    .find((p) => !p.type || p.type === "reverse");
                    
                const dx = endPoint.x - lastMovePoint.x;
                const dy = endPoint.y - lastMovePoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Adjust progress based on actual distance
                progress += (moveSpeed * deltaTime) / (distance || 1);

                if (progress >= 1) {
                    robotX = endPoint.x;
                    robotY = endPoint.y;
                    progress = 0;
                    currentPoint++;
                    if (currentPoint < points.length - 1) {
                        isRotating = true;
                    }
                } else {
                    robotX = lastMovePoint.x + dx * progress;
                    robotY = lastMovePoint.y + dy * progress;
                    // Keep using the same angle during movement - no change
                    robotAngle = movementAngle;
                }
            } else {
                currentPoint++;
            }
        }

        drawGrid();
        drawRobot(robotX, robotY, robotAngle);

        if (!isSimulationPaused) {
            if (currentPoint < points.length - 1) {
                currentSimulation = requestAnimationFrame(animate);
            } else if (isSimulationLooping) {
                currentPoint = 0;
                robotX = points[0].x;
                robotY = points[0].y;
                robotAngle = 0;
                isRotating = true;
                isReversing = false;
                currentReverseTarget = null;
                progress = 0;
                currentSimulation = requestAnimationFrame(animate);
            } else {
                stopSimulation();
            }
        }
    }

    // Cancel any existing animation before starting new one
    if (currentSimulation) {
        cancelAnimationFrame(currentSimulation);
    }
    currentSimulation = requestAnimationFrame(animate);
}

function clearAllRecentPaths() {
    const overlay = createOverlay();
    document.body.appendChild(overlay);

    const popup = document.createElement("div");
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
    <p style="margin-bottom: 20px;">Are you sure you want to clear all recent paths?</p>
    <p style="margin-bottom: 20px;">THIS CAN'T BE UNDONE!!!!</p>
    <button onclick="confirmClearAll()" style="margin-right: 10px;">Yes</button>
    <button onclick="closePopup()">No</button>
    <div style="margin-top: 10px; color: #999; font-size: 12px;">Press ESC to cancel</div>
  `;

    document.body.appendChild(popup);
    overlay.addEventListener("click", closePopup);
}

function confirmClearAll() {
    recentPaths = [];
    localStorage.removeItem("recentPaths");
    document.getElementById("pathName").textContent = "No File";
    document.getElementById("pathName").style.cursor = "default";
    document.getElementById("pathName").onclick = null;
    points = [];
    updatePointsList();
    drawGrid();
    updateRecentPathsDropdown();
    updateSimulationButton(); // Update button after clearing all paths
    closePopup();
}

function updateSimulationButton() {
    const simButton = document.getElementById("simButton");
    const pathName = document.getElementById("pathName").textContent;
    if (points.length > 0 && pathName !== "No File") {
        simButton.style.cursor = "pointer";
        simButton.style.opacity = "1";
    } else {
        simButton.style.cursor = "not-allowed";
        simButton.style.opacity = "0.5";
    }
}