# AutoGrid Planner by team **785Z**
## [AUTOGRID PLANNER (LINK)](https://parkerrasys.github.io/AutoGrid-Planner/)
[AutoGrid Repository](https://github.com/parkerrasys/AutoGrid/) 
### (A tool for easily laying out your AutoGrid path)

### Notes

>**AutoGrid is still being developed alongside AutoGrid Planner**
> Not everything works yet at the current state, still need to fix a couple bugs.
> This verison of the AutoGrid Planner has basic funtions such as drawing a path for your robot to follow.
> You are currently only able to draw then build your code for auton, no funtions such as importing or exporting works yet!
** **
<div class="logo-title">
  <a href="https://parkerrasys.github.io/AutoGrid-Planner/" target="_blank" class="hover-effect">
    <img src="https://github.com/user-attachments/assets/dc9531b7-a99f-4ac5-b29b-13b0ae5269df" alt="image">
    <div class="tooltip">Will redirect to AutoGrid Planner</div>
  </a>
</div>

<style>
  .logo-title {
    position: relative;
    display: inline-block;
  }

  .hover-effect {
    position: relative;
    display: inline-block;
    text-decoration: none;
  }

  /* Style for the image */
  .hover-effect img {
    display: block;
    transition: filter 0.3s ease; /* Smooth dimming effect */
  }

  /* Dim the image when hovered */
  .hover-effect:hover img {
    filter: brightness(70%);
  }

  /* Tooltip styling */
  .tooltip {
    display: none; /* Hidden by default */
    position: absolute;
    bottom: -40px; /* Adjust position above/below image */
    left: 50%;
    transform: translateX(-50%);
    background-color: black;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 10; /* Make sure it appears above other content */
  }

  /* Show the tooltip on hover */
  .hover-effect:hover .tooltip {
    display: block;
    opacity: 1;
  }
</style>

