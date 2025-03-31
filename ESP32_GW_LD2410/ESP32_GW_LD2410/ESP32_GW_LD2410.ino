
/*************************************************************
  Download latest ERa library here:
    https://github.com/eoh-jsc/era-lib/releases/latest
    https://www.arduino.cc/reference/en/libraries/era
    https://registry.platformio.org/libraries/eoh-ltd/ERa/installation

    ERa website:                https://e-ra.io
    ERa blog:                   https://iotasia.org
    ERa forum:                  https://forum.eoh.io
    Follow us:                  https://www.fb.com/EoHPlatform
 *************************************************************/

// Enable debug console
#define ERA_DEBUG

/* Define MQTT host */
#define DEFAULT_MQTT_HOST "mqtt1.eoh.io"

// You should get Auth Token in the ERa App or ERa Dashboard
#define ERA_AUTH_TOKEN "a3598249-0bf8-4d9a-8914-cef485a5d2c2"

/* Define setting button */
// #define BUTTON_PIN              0

#if defined(BUTTON_PIN)
    // Active low (false), Active high (true)
    #define BUTTON_INVERT       false
    #define BUTTON_HOLD_TIMEOUT 5000UL

    // This directive is used to specify whether the configuration should be erased.
    // If it's set to true, the configuration will be erased.
    #define ERA_ERASE_CONFIG    false
#endif
#if defined(ESP32)
  #ifdef ESP_IDF_VERSION_MAJOR // IDF 4+FF
    #if CONFIG_IDF_TARGET_ESP32 // ESP32/PICO-D4
      #define MONITOR_SERIAL Serial
      #define RADAR_SERIAL Serial1
      #define RADAR_RX_PIN 32
      #define RADAR_TX_PIN 33
    #elif CONFIG_IDF_TARGET_ESP32S2
      #define MONITOR_SERIAL Serial
      #define RADAR_SERIAL Serial1
      #define RADAR_RX_PIN 9
      #define RADAR_TX_PIN 8
    #elif CONFIG_IDF_TARGET_ESP32C3
      #define MONITOR_SERIAL Serial
      #define RADAR_SERIAL Serial1
      #define RADAR_RX_PIN 4
      #define RADAR_TX_PIN 5
    #else 
      #error Target CONFIG_IDF_TARGET is not supported
    #endif
  #else // ESP32 Before IDF 4.0
    #define MONITOR_SERIAL Serial
    #define RADAR_SERIAL Serial1
    #define RADAR_RX_PIN 32
    #define RADAR_TX_PIN 33
  #endif
#elif defined(__AVR_ATmega32U4__)
  #define MONITOR_SERIAL Serial
  #define RADAR_SERIAL Serial1
  #define RADAR_RX_PIN 0
  #define RADAR_TX_PIN 1
#endif
#include <Arduino.h>
#include <ERa.hpp>
#include <ld2410.h>

ld2410 radar;

uint32_t lastReading = 0;
bool radarConnected = false;

const char ssid[] = "eoh.io";
const char pass[] = "Eoh@2020";

WiFiClient mbTcpClient;

#if defined(ERA_AUTOMATION)
    #include <Automation/ERaSmart.hpp>

    #if defined(ESP32) || defined(ESP8266)
        #include <Time/ERaEspTime.hpp>
        ERaEspTime syncTime;
    #else
        #define USE_BASE_TIME

        #include <Time/ERaBaseTime.hpp>
        ERaBaseTime syncTime;
    #endif

    ERaSmart smart(ERa, syncTime);
#endif

#if defined(BUTTON_PIN)
    #include <ERa/ERaButton.hpp>

    ERaButton button;

    #if ERA_VERSION_NUMBER >= ERA_VERSION_VAL(1, 2, 0)
        static void eventButton(uint8_t pin, ButtonEventT event) {
            if (event != ButtonEventT::BUTTON_ON_HOLD) {
                return;
            }
            ERa.switchToConfig(ERA_ERASE_CONFIG);
            (void)pin;
        }
    #else
        static void eventButton(ButtonEventT event) {
            if (event != ButtonEventT::BUTTON_ON_HOLD) {
                return;
            }
            ERa.switchToConfig(ERA_ERASE_CONFIG);
        }
    #endif

    #if defined(ESP32)
        #include <pthread.h>

        pthread_t pthreadButton;

        static void* handlerButton(void* args) {
            for (;;) {
                button.run();
                ERaDelay(10);
            }
            pthread_exit(NULL);
        }

        void initButton() {
            pinMode(BUTTON_PIN, INPUT);
            button.setButton(BUTTON_PIN, digitalRead, eventButton,
                            BUTTON_INVERT).onHold(BUTTON_HOLD_TIMEOUT);
            pthread_create(&pthreadButton, NULL, handlerButton, NULL);
        }
    #elif defined(ESP8266)
        #include <Ticker.h>

        Ticker ticker;

        static void handlerButton() {
            button.run();
        }

        void initButton() {
            pinMode(BUTTON_PIN, INPUT);
            button.setButton(BUTTON_PIN, digitalRead, eventButton,
                            BUTTON_INVERT).onHold(BUTTON_HOLD_TIMEOUT);
            ticker.attach_ms(100, handlerButton);
        }
    #elif defined(ARDUINO_AMEBA)
        #include <GTimer.h>

        const uint32_t timerIdButton {0};

        static void handlerButton(uint32_t data) {
            button.run();
            (void)data;
        }

        void initButton() {
            pinMode(BUTTON_PIN, INPUT);
            button.setButton(BUTTON_PIN, digitalReadArduino, eventButton,
                            BUTTON_INVERT).onHold(BUTTON_HOLD_TIMEOUT);
            GTimer.begin(timerIdButton, (100 * 1000), handlerButton);
        }
    #endif
#endif

/* This function will run every time ERa is connected */
ERA_CONNECTED() {
    ERA_LOG(ERA_PSTR("ERa"), ERA_PSTR("ERa connected!"));
}

/* This function will run every time ERa is disconnected */
ERA_DISCONNECTED() {
    ERA_LOG(ERA_PSTR("ERa"), ERA_PSTR("ERa disconnected!"));
}

/* This function print uptime every second */
void timerEvent() {
    ERA_LOG(ERA_PSTR("Timer"), ERA_PSTR("Uptime: %d"), ERaMillis() / 1000L);
      radar.read();
  if(radar.isConnected() && millis() - lastReading > 1000)  //Report every 1000ms
  {
    lastReading = millis();
    if(radar.presenceDetected())
    {
      if(radar.stationaryTargetDetected())
      {
        Serial.print(F("Stationary target: "));
        Serial.print(radar.stationaryTargetDistance());
        Serial.print(F("cm energy:"));
        Serial.print(radar.stationaryTargetEnergy());
        Serial.print(' ');
        
      }
      if(radar.movingTargetDetected())
      {
        Serial.print(F("Moving target: "));
        Serial.print(radar.movingTargetDistance());
        Serial.print(F("cm energy:"));
        Serial.print(radar.movingTargetEnergy());
      }
      ERa.virtualWrite(V0,0);
      Serial.println();
    }
    else
    {
      Serial.println(F("No target"));
      ERa.virtualWrite(V0,1);
    }
  }
}

#if defined(USE_BASE_TIME)
    unsigned long getTimeCallback() {
        // Please implement your own function
        // to get the current time in seconds.
        return 0;
    } 
#endif

void setup() {
    /* Setup debug console */
#if defined(ERA_DEBUG)
    Serial.begin(115200);
#endif

#if defined(BUTTON_PIN)
    /* Initializing button. */
    initButton();
    /* Enable read/write WiFi credentials */
    ERa.setPersistent(true);
#endif

#if defined(USE_BASE_TIME)
    syncTime.setGetTimeCallback(getTimeCallback);
#endif
  MONITOR_SERIAL.begin(115200); //Feedback over Serial Monitor
  //radar.debug(MONITOR_SERIAL); //Uncomment to show debug information from the library on the Serial Monitor. By default this does not show sensor reads as they are very frequent.
  #if defined(ESP32)
    RADAR_SERIAL.begin(256000, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN); //UART for monitoring the radar
  #elif defined(__AVR_ATmega32U4__)
    RADAR_SERIAL.begin(256000); //UART for monitoring the radar
  #endif
  delay(500);
  MONITOR_SERIAL.print(F("\nConnect LD2410 radar TX to GPIO:"));
  MONITOR_SERIAL.println(RADAR_RX_PIN);
  MONITOR_SERIAL.print(F("Connect LD2410 radar RX to GPIO:"));
  MONITOR_SERIAL.println(RADAR_TX_PIN);
  MONITOR_SERIAL.print(F("LD2410 radar sensor initialising: "));
  if(radar.begin(RADAR_SERIAL))
  {
    MONITOR_SERIAL.println(F("OK"));
    MONITOR_SERIAL.print(F("LD2410 firmware version: "));
    MONITOR_SERIAL.print(radar.firmware_major_version);
    MONITOR_SERIAL.print('.');
    MONITOR_SERIAL.print(radar.firmware_minor_version);
    MONITOR_SERIAL.print('.');
    MONITOR_SERIAL.println(radar.firmware_bugfix_version, HEX);
  }
  else
  {
    MONITOR_SERIAL.println(F("not connected"));
  }
    /* Setup Client for Modbus TCP/IP */
    ERa.setModbusClient(mbTcpClient);

    /* Set scan WiFi. If activated, the board will scan
       and connect to the best quality WiFi. */
    ERa.setScanWiFi(true);
            
    /* Initializing the ERa library. */
    ERa.begin(ssid, pass);

    /* Setup timer called function every second */
    ERa.addInterval(1000L, timerEvent);
}

void loop() {
    ERa.run();
}
