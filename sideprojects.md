---
layout: projects
title: Portfolio
---

# Teaching/Research Artifacts

This page provides a peak into the side projects I develop for aid in teaching and provide as tools for research and communication. Another purpose has been to test the theoretical concepts manually asa a source to report later on. Yet anothher one is to maketh is place asserver as the reference point for future checking in.  The development of these aides has involved the use of Large Language Models in varying degrees.

<style>
  .portfolio-toolbar{
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
    margin:20px 0 24px;
  }
  .portfolio-toolbar label{
    font-size:13px;
    text-transform:uppercase;
    letter-spacing:.06em;
    color:#666;
  }
  #categoryFilter{
    padding:7px 12px;
    border-radius:4px;
    border:1px solid rgba(0,0,0,0.25);
    background:#fff;
    font-size:14px;
    cursor:pointer;
  }
  .portfolio-count{
    font-size:13px;
    color:#888;
  }
  .portfolio-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));
    gap:22px;
    margin:0 0 20px;
  }
  .project-item{
    border:1px solid rgba(0,0,0,0.12);
    border-radius:6px;
    overflow:hidden;
    background:#fff;
    transition:box-shadow .15s ease, transform .15s ease;
  }
  .project-item:hover{
    box-shadow:0 6px 16px rgba(0,0,0,0.09);
    transform:translateY(-2px);
  }
  .project-item a{
    display:block;
    text-decoration:none;
    color:inherit;
  }
  .project-item img{
    width:100%;
    height:160px;
    object-fit:cover;
    display:block;
    background:#f2f2f2;
  }
  .project-item .tile-body{
    padding:12px 14px 16px;
  }
  .project-item .tag{
    display:inline-block;
    font-size:10.5px;
    text-transform:uppercase;
    letter-spacing:.06em;
    color:#7a7a7a;
    margin-bottom:6px;
  }
  .project-item h3{
    margin:0;
    font-size:15px;
    line-height:1.35;
  }
  .project-item.is-hidden{
    display:none;
  }
</style>

<div class="portfolio-toolbar">
  <label for="categoryFilter">Category</label>
  <select id="categoryFilter">
    <option value="all">All Projects</option>
    <option value="robotics">Robotics</option>
    <option value="embedded">Embedded Systems</option>
    <option value="controls">Controls &amp; Simulation</option>
    <option value="signal">Signal Processing</option>
    <option value="tools">Tools &amp; Calculators</option>
  </select>
  <span class="portfolio-count" id="portfolioCount"></span>
</div>

<div class="portfolio-grid" id="portfolioGrid">

  <div class="project-item" data-category="embedded">
    <a href="./projects/adc_waveform_sampler.html" target="_blank">
      <img src="/assets/images/sin_quantize.png" alt="LED and ESP32" />
      <div class="tile-body">
        <span class="tag">Embedded Systems</span>
        <h3>Demonstration of Quantization using ADC</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="embedded">
    <a href="./projects/powermeasure_esp32.html" target="_blank">
      <img src="/assets/images/violet_ON.png" alt="LED and ESP32" />
      <div class="tile-body">
        <span class="tag">Embedded Systems</span>
        <h3>Power Measurement in an ESP32 Blinking an LED</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="controls">
    <a href="./projects/systemID_2ndOrder.html" target="_blank">
      <img src="/assets/images/sysID_GUI.png" alt="System ID with 2nd Order" />
      <div class="tile-body">
        <span class="tag">Controls &amp; Simulation</span>
        <h3>System Identification for Second Order Systems</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="signal">
    <a href="./projects/gait_event_recognize.html" target="_blank">
      <img src="/assets/images/gait_events.png" alt="Recognizing four events in gait" />
      <div class="tile-body">
        <span class="tag">Signal Processing</span>
        <h3>Recognizing Gait Events from Raw Accelerometer Data</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="robotics">
    <a href="./projects/discrete-convolution.html" target="_blank">
      <img src="/assets/images/discrete-convo.png" alt="Discrete Convolution" />
      <div class="tile-body">
        <span class="tag">Signal Processing</span>
        <h3>A Demonstration of Discrete Convolution</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="robotics">
    <a href="./projects/continuous-convolution.html" target="_blank">
      <img src="/assets/images/cont-convo.png" alt="Continuous Convolution" />
      <div class="tile-body">
        <span class="tag">Signal Processing</span>
        <h3>A Demonstration of Continuous Convolution</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="controls">
    <a href="./simulations/sim_dyn_systems.html" target="_blank">
      <img src="/assets/images/dynamic_systems.png" alt="Simulating Dynamical Systems" />
      <div class="tile-body">
        <span class="tag">Controls &amp; Simulation</span>
        <h3>A GUI for Simulating Dynamical Systems</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="robotics">
    <a href="./projects/astar_rrt_planner_2.html" target="_blank">
      <img src="/assets/images/robot_planner.webp" alt="Comparison of Robot Path Planners" />
      <div class="tile-body">
        <span class="tag">Robotics</span>
        <h3>Animation for Comparing the Performance of Robot Path Planners</h3>
      </div>
    </a>
  </div>

<div class="project-item" data-category="tools">
    <a href="./projects/investment_calculator_USD.html" target="_blank">
      <img src="/assets/images/invest.jpg" alt="Investment Tool" />
      <div class="tile-body">
        <span class="tag">Tools &amp; Calculators</span>
        <h3>Investment and Withdrawal Tool in USD (NOT Financial Advice)</h3>
      </div>
    </a>
  </div>
  <div class="project-item" data-category="tools">
    <a href="./projects/investment_calculator_pkr.html" target="_blank">
      <img src="/assets/images/invest.jpg" alt="Investment Tool" />
      <div class="tile-body">
        <span class="tag">Tools &amp; Calculators</span>
        <h3>Investment and Withdrawal Tool in PKR (NOT Financial Advice)</h3>
      </div>
    </a>
  </div>

  <div class="project-item" data-category="robotics">
    <a href="./projects/turtlebot_nav.html" target="_blank">
      <img src="/assets/images/turtlebot_gazebo.jpg" alt="Mobile Robot Simulation" />
      <div class="tile-body">
        <span class="tag">Robotics</span>
        <h3>Simulated Mobile Robot: Mapping, Navigation &amp; Vision</h3>
      </div>
    </a>
  </div>
<div class="project-item" data-category="robotics">
    <a href="./projects/robot_manipulator.html" target="_blank">
      <img src="/assets/images/turtlebot_gazebo.jpg" alt="Mobile Manipulator" />
      <div class="tile-body">
        <span class="tag">Robotics</span>
        <h3>Manipulator on Mobile Robot</h3>
      </div>
    </a>
  </div>

</div>

<script>
(function(){
  var select = document.getElementById('categoryFilter');
  var items = document.querySelectorAll('#portfolioGrid .project-item');
  var count = document.getElementById('portfolioCount');

  function applyFilter(){
    var val = select.value;
    var visible = 0;
    items.forEach(function(item){
      var match = (val === 'all' || item.getAttribute('data-category') === val);
      item.classList.toggle('is-hidden', !match);
      if (match) visible++;
    });
    count.textContent = visible + (visible === 1 ? ' project' : ' projects');
  }

  select.addEventListener('change', applyFilter);
  applyFilter();
})();
</script>