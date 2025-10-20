import cv2
from pyzbar.pyzbar import decode
import requests
import RPi.GPIO as GPIO
import time
import re
from rpi_ws281x import PixelStrip, Color

# ----------------- CONFIGURACIÓN GPIO -----------------
RELAY_PIN = 26
GPIO.setmode(GPIO.BCM)
GPIO.setup(RELAY_PIN, GPIO.OUT)
GPIO.output(RELAY_PIN, GPIO.LOW)

# ----------------- CONFIGURACIÓN LEDS WS2811 -----------------
LED_COUNT = 4        # Número de LEDs
LED_PIN = 12          # GPIO12
LED_FREQ_HZ = 800000 # Frecuencia de señal LED
LED_DMA = 10         # DMA channel
LED_BRIGHTNESS = 255 # Brillo 0-255
LED_INVERT = False   # Invertir señal
LED_CHANNEL = 0

# Inicializar la tira de LEDs
strip = PixelStrip(LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL)
strip.begin()

def encender_leds(color, duracion=2):
    """Enciende todos los LEDs con un color específico por X segundos"""
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, color)
    strip.show()
    time.sleep(duracion)
    # Apagar LEDs después
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, Color(0, 0, 0))
    strip.show()

# ----------------- RELÉ -----------------
def activar_rele():
    print("✅ Credencial válida, activando relé...")
    GPIO.output(RELAY_PIN, GPIO.HIGH)
    time.sleep(0.5)
    GPIO.output(RELAY_PIN, GPIO.LOW)

# ----------------- UUID -----------------
def extraer_uuid(url):
    match = re.search(r"/validar_credencial/([a-f0-9\-]+)", url)
    return match.group(1) if match else None

# ----------------- VALIDACIÓN -----------------
def validar_credencial(uuid):
    urls = [
        f"https://cibervoluntarios.cittpass.cl/api/usuarios/obtener/{uuid}",
        f"https://cittpass.cl/api/usuarios/obtener/{uuid}"
    ]
    for api_url in urls:
        try:
            resp = requests.get(api_url, timeout=5)
            if resp.status_code == 200 and resp.json():
                return resp.json()
        except Exception as e:
            print(f"Error consultando {api_url}: {e}")
    return None

# ----------------- CÁMARA -----------------
cap = cv2.VideoCapture(0)

print("📷 Escaneando QR... (presiona Ctrl+C para salir)")
try:
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        for qr in decode(frame):
            qr_data = qr.data.decode("utf-8")
            print(f"🔍 QR detectado: {qr_data}")

            uuid = extraer_uuid(qr_data)
            if uuid:
                print(f"UUID detectado: {uuid}")
                usuario = validar_credencial(uuid)
                if usuario:
                    print("✅ Usuario válido:", usuario)
                    activar_rele()
                    encender_leds(Color(0, 255, 0), 2)  # Verde
                else:
                    print("❌ Credencial no válida o usuario inactivo.")
                    encender_leds(Color(255, 0, 0), 2)  # Rojo
            else:
                print("⚠️ QR no contiene UUID válido.")
                encender_leds(Color(255, 0, 0), 2)  # Rojo

            time.sleep(2)  # espera antes de leer otro QR
        
        time.sleep(0.13)

        cv2.imshow("Lector QR", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print("\n🛑 Programa detenido por el usuario.")

finally:
    cap.release()
    cv2.destroyAllWindows()
    GPIO.cleanup()
    # Apagar LEDs al salir
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, Color(0, 0, 0))
    strip.show()
