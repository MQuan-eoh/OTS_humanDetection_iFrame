const eraWidget = new EraWidget();
let configHuman = null;
let lastHumanDetectionValue = NaN;
eraWidget.init({
  onConfiguration: (configuration) => {
    configHuman = configuration.realtime_configs[0];
  },
  onValues: (values) => {
    if (configHuman && values[configHuman.id]) {
      const humanDetectionValue = values[configHuman.id].value;
      console.log("Received humanDetectionValue:", humanDetectionValue);

      if (humanDetectionValue === 0 && lastHumanDetectionValue !== 0) {
        console.log(
          "Human detected (humanDetectionValue == 0). Taking a picture..."
        );
        captureImage();
        detectionCount++;
        localStorage.setItem("detectionCount", detectionCount);
        document.getElementById("detectionCount").textContent = detectionCount;
      }

      lastHumanDetectionValue = humanDetectionValue;
    } else {
      console.log(
        "No valid values received for humanDetectionSensor with ID:",
        configHuman.id
      );
    }
  },
});
