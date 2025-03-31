// Variables to track detection state and count
let detectionCount = parseInt(localStorage.getItem("detectionCount"), 10) || 0;
let lastImageUrl = ""; // Store URL of the last captured image
let correctPassword = ""; // Password for image access - set as needed

// Initialize detection count from localStorage
document.getElementById("detectionCount").textContent = detectionCount;
function showNotification() {
  const notification = document.createElement("div");
  notification.className = "notification";
  const now = new Date();

  notification.innerHTML = `
    <div class="notification-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    </div>
    <div class="notification-content">
      <div class="notification-title">Human Detected</div>
      <div class="notification-message">New motion detected and image captured</div>
      <div class="notification-timestamp">${now.toLocaleTimeString()}</div>
    </div>
    <div class="notification-progress"><span></span></div>
  `;

  const container = document.getElementById("notificationContainer");
  container.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add("show"), 10);

  // Animate progress bar
  const progressSpan = notification.querySelector(
    ".notification-progress span"
  );
  progressSpan.style.width = "0%";
  setTimeout(() => {
    progressSpan.style.width = "100%";
  }, 10);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      container.removeChild(notification);
    }, 500);
  }, 5000);
}
/**
 * Captures an image from the camera by making requests to the camera endpoint
 * Uses a two-step capture process as in the original code
 */
async function captureImage() {
  document.getElementById("cameraOverlay").classList.add("active");
  showNotification();

  // Increment detectionCount only once here, at the start of the process
  detectionCount++;
  localStorage.setItem("detectionCount", detectionCount);
  document.getElementById("detectionCount").textContent = detectionCount;

  try {
    //First capture
    await takePicture();

    //Wait 1.6s and take a second shot
    setTimeout(async () => {
      await takePicture(false); // Pass false parameter to not increment counter
      await fetchRecentImages();
      document.getElementById("cameraOverlay").classList.remove("active");
    }, 1600);
  } catch (error) {
    console.error("Lỗi trong quá trình chụp ảnh:", error);
    document.getElementById("cameraOverlay").classList.remove("active");
  }
}

async function takePicture(countDetection = true) {
  try {
    // Using window.open to make request and receive imageUrl
    var hiddenWindow = window.open(
      "about:blank",
      "_blank",
      "width=1,height=1,top=-1000,left=-1000"
    );

    if (hiddenWindow) {
      // Create an XMLHttpRequest in the new window to fetch the data
      hiddenWindow.document.write(`
        <html>
        <body>
          <script>
            function fetchImage() {
              var xhr = new XMLHttpRequest();
              xhr.open('GET', 'http://192.168.1.47:8000/capture', true);
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  if (xhr.status === 200) {
                    var data = JSON.parse(xhr.responseText);
                    window.opener.updateImageFromCapture(data.imageUrl);
                    window.close();
                  } else {
                    window.opener.captureError("HTTP Error: " + xhr.status);
                    window.close();
                  }
                }
              };
              xhr.send();
            }
            fetchImage();
          </script>
        </body>
        </html>
      `);
    } else {
      // If window.open was blocked, fall back to direct fetch
      const response = await fetch("http://192.168.1.47:8000/capture");
      if (!response.ok) throw new Error("Lỗi API");
      const data = await response.json();

      const img = document.getElementById("cameraImage");
      img.src = data.imageUrl;
      updateLastAppearance(data.imageUrl);
    }

    // Set a timeout to close the window if it doesn't close itself
    setTimeout(() => {
      if (hiddenWindow && !hiddenWindow.closed) {
        hiddenWindow.close();
      }
    }, 5000);
  } catch (error) {
    console.error("Lỗi chụp ảnh:", error);
  }
}

// Function to be called from the popup window
function updateImageFromCapture(imageUrl) {
  const img = document.getElementById("cameraImage");
  img.src = imageUrl;
  updateLastAppearance(imageUrl);
}

// Function to handle capture errors
function captureError(errorMessage) {
  console.error("Lỗi chụp ảnh:", errorMessage);
}

/**
 * Updates the last appearance information with the latest image URL
 * and updates the timestamp
 */
function updateLastAppearance(imageUrl) {
  lastImageUrl = imageUrl;
  document.getElementById("lastImageLink").href = lastImageUrl;

  const now = new Date();
  document.getElementById("lastAppearanceTime").textContent =
    now.toLocaleString();
  document.getElementById("lastCheckTime").textContent = now.toLocaleString();
}

/**
 * Updates the date and time display
 */
function updateDateTime() {
  const now = new Date();

  // Chỉ định rõ múi giờ Việt Nam
  const options = {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  const formattedDateTime = now.toLocaleString("vi-VN", options);
  document.getElementById("datetime").textContent = formattedDateTime;
}

// Update the time display every second
setInterval(updateDateTime, 1000);
updateDateTime(); // Initial update
function setupDailyReset() {
  // Check if we need to reset based on last reset time
  const lastResetTime = localStorage.getItem("lastResetTime");
  const now = new Date();

  if (lastResetTime) {
    const lastReset = new Date(parseInt(lastResetTime, 10));
    const hoursDiff = (now - lastReset) / (1000 * 60 * 60);

    if (hoursDiff >= 24) {
      // Reset if 24+ hours have passed
      detectionCount = 0;
      localStorage.setItem("detectionCount", detectionCount);
      document.getElementById("detectionCount").textContent = detectionCount;
      localStorage.setItem("lastResetTime", now.getTime().toString());
    }
  } else {
    // First time running - set initial reset time
    localStorage.setItem("lastResetTime", now.getTime().toString());
  }

  // Calculate time until next reset (midnight)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilReset = tomorrow - now;

  // Schedule reset
  setTimeout(() => {
    detectionCount = 0;
    localStorage.setItem("detectionCount", detectionCount);
    document.getElementById("detectionCount").textContent = detectionCount;
    localStorage.setItem("lastResetTime", new Date().getTime().toString());

    // Set up next day's reset
    setupDailyReset();
  }, timeUntilReset);
}

// Set up event listener for manual capture button
document
  .getElementById("captureButton")
  .addEventListener("click", captureImage);

//==========Recent Images===========
// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB4AGVtaJ7yAs39ATHDfPYwFcCRJDBcTKA",
  authDomain: "esp32cam-4dbf9.firebaseapp.com",
  projectId: "esp32cam-4dbf9",
  storageBucket: "esp32cam-4dbf9.appspot.com",
  messagingSenderId: "643068912657",
  appId: "1:643068912657:web:aef259b7810197c62a7db0",
  measurementId: "G-L6407KGZQN",
};

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();

// Hàm lấy danh sách hình ảnh từ Firebase Storage
async function getSampleImages() {
  try {
    const storageRef = storage.ref("images"); // Thư mục chứa hình ảnh
    const result = await storageRef.listAll();

    const items = await Promise.all(
      result.items.map(async (item) => {
        const url = await item.getDownloadURL();
        const metadata = await item.getMetadata();
        return {
          url: url,
          time: new Date(metadata.timeCreated).toLocaleTimeString(),
        };
      })
    );

    // Sắp xếp theo thời gian tạo mới nhất
    items.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Lấy 3 hình ảnh mới nhất (có thể điều chỉnh số lượng)
    return items.slice(0, 3);
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
}

async function fetchRecentImages() {
  try {
    const storageRef = storage.ref("images");
    const result = await storageRef.listAll();

    const items = await Promise.all(
      result.items.map(async (item) => {
        const metadata = await item.getMetadata();
        return {
          name: item.name,
          url: await item.getDownloadURL(),
          timeCreated: metadata.timeCreated,
        };
      })
    );

    // Sort by latest creation time
    items.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

    // Lấy 10 ảnh đầu tiên
    const recentImages = items.slice(0, 10);
    displayImages(recentImages);
  } catch (error) {
    console.error("Error fetching images:", error);
  }
}

function displayImages(images) {
  const grid = document.getElementById("imageGrid");
  grid.innerHTML = "";

  images.forEach((img) => {
    const div = document.createElement("div");
    div.className = "image-item";
    div.innerHTML = `
      <img src="${img.url}" alt="${img.name}">
      <div class="image-time">
        ${new Date(img.timeCreated).toLocaleString()}
      </div>
    `;

    // Add click handler to view large image
    div.addEventListener("click", () => {
      window.open(img.url, "_blank");
    });

    grid.appendChild(div);
  });
}

// Add images to gird
function addRecentImages(images) {
  const imageGrid = document.getElementById("imageGrid");
  images.forEach((img) => {
    const imageItem = document.createElement("div");
    imageItem.classList.add("image-item");

    const imgElement = document.createElement("img");
    imgElement.src = img.url;
    imgElement.alt = "Recent Capture";

    const timeElement = document.createElement("div");
    timeElement.classList.add("image-time");
    timeElement.textContent = img.time;

    imageItem.appendChild(imgElement);
    imageItem.appendChild(timeElement);

    imageGrid.appendChild(imageItem);
  });
}
// Toggle fullscreen mode function
function toggleFullScreen() {
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  // Add animation class
  fullscreenBtn.classList.add("animating");
  setTimeout(() => fullscreenBtn.classList.remove("animating"), 300);

  if (
    !document.fullscreenElement &&
    !document.mozFullScreenElement &&
    !document.webkitFullscreenElement &&
    !document.msFullscreenElement
  ) {
    // Enter fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      // Firefox
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      // Chrome, Safari, Opera
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      // IE/Edge
      document.documentElement.msRequestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      // Firefox
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      // Chrome, Safari, Opera
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      // IE/Edge
      document.msExitFullscreen();
    }
  }
}

// Listen for fullscreen change events
document.addEventListener("fullscreenchange", onFullScreenChange);
document.addEventListener("webkitfullscreenchange", onFullScreenChange);
document.addEventListener("mozfullscreenchange", onFullScreenChange);
document.addEventListener("MSFullscreenChange", onFullScreenChange);

function onFullScreenChange() {
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  if (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  ) {
    // In fullscreen mode
    fullscreenBtn.classList.add("is-fullscreen");
    fullscreenBtn.title = "Exit Fullscreen";
    fullscreenBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
      </svg>
    `;
  } else {
    // Not in fullscreen mode
    fullscreenBtn.classList.remove("is-fullscreen");
    fullscreenBtn.title = "Enter Fullscreen";
    fullscreenBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
    `;
  }
}
//Load imgs from Firebase when loaded page
document.addEventListener("DOMContentLoaded", async () => {
  const imageGrid = document.getElementById("imageGrid");
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", toggleFullScreen);
  }
  let currentScroll = 0;
  const scrollAmount = 240; // Adjust based on image width and gaps

  nextButton.addEventListener("click", () => {
    currentScroll += scrollAmount;
    imageGrid.scrollTo({
      left: currentScroll,
      behavior: "smooth",
    });
  });

  prevButton.addEventListener("click", () => {
    currentScroll -= scrollAmount;
    if (currentScroll < 0) currentScroll = 0;
    imageGrid.scrollTo({
      left: currentScroll,
      behavior: "smooth",
    });
  });

  //Add img on firebase and add to grid
  const sampleImages = await getSampleImages();
  addRecentImages(sampleImages);

  setupDailyReset();
  fetchRecentImages();
});

// Call fetch function when page loads and after each photo is taken
document.addEventListener("DOMContentLoaded", fetchRecentImages);
