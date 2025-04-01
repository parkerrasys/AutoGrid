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
            movementAngle = robotAngle;  // Store the angle we're moving at, to avoid snapping
            progress = 0; // Reset progress to begin moving from the current position
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
            isRotating = true; // Continue rotating for the next point
            isReversing = false;
            currentReverseTarget = null; // Clear reverse target once finished
        } else {
            // Move towards the reverse target based on progress
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