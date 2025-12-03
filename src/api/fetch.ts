// services/boletosService.ts

export interface Premio {
  id: number;
  nombre: string;
  cantidad_ganadores: number;
  activo: boolean;
}

export interface Ganador {
  id: number;
  nombre: string;
  numero_participante: string;
  created_at: string;
  updated_at: string;
}

export interface PremiosResponse {
  success: boolean;
  data?: Premio[];
  error?: string;
}

export interface SeleccionarBoletoRequest {
  premio_id: number;
}

export interface SeleccionarBoletoResponse {
  success: boolean;
  message: string;
  ganadores: Ganador[];
}

export interface SeleccionarBoletoApiResponse {
  success: boolean;
  data?: SeleccionarBoletoResponse;
  error?: string;
}

class BoletosService {
  private readonly baseUrl = "https://tombolaback.capitaldevs.com/api";

  /**
   * Obtiene todos los premios desde la API
   * @returns Promise con la respuesta de la API
   */
  async fetchPremios(): Promise<PremiosResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/premios`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Agregar timeout opcional
        signal: AbortSignal.timeout(10000), // 10 segundos timeout
      });

      if (!response.ok) {
        throw new Error(
          `Error HTTP: ${response.status} - ${response.statusText}`
        );
      }

      const jsonData = await response.json();

      // La API devuelve { success: true, data: [...] }
      if (jsonData.success && Array.isArray(jsonData.data)) {
        return {
          success: true,
          data: jsonData.data,
        };
      }

      throw new Error("Formato de respuesta inválido");
    } catch (error) {
      console.error("Error al obtener premios:", error);

      // No mostrar error de timeout al usuario, solo loguearlo
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.message.includes("timeout") ||
          error.message.includes("timed out") ||
          error.message.includes("signal timed out"))
      ) {
        console.warn(
          "Timeout al cargar premios, se reintentará automáticamente"
        );
        return {
          success: false,
          error: undefined, // No mostrar error de timeout
        };
      }

      let errorMessage = "Error desconocido al cargar premios";

      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "Sin conexión a internet o servidor no disponible";
      } else if (
        error instanceof Error &&
        !error.message.includes("timeout") &&
        !error.message.includes("timed out")
      ) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Selecciona ganadores para un premio desde el servidor
   * @param premioId - ID del premio (1, 2, 3, etc.)
   * @returns Promise con la respuesta de los ganadores seleccionados
   */
  async seleccionarGanadores(
    premioId: number
  ): Promise<SeleccionarBoletoApiResponse> {
    try {
      const requestBody: SeleccionarBoletoRequest = {
        premio_id: premioId,
      };

      const response = await fetch(`${this.baseUrl}/tombola/girar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000), // 10 segundos timeout
      });

      if (!response.ok) {
        throw new Error(
          `Error HTTP: ${response.status} - ${response.statusText}`
        );
      }

      const data: SeleccionarBoletoResponse = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Error al seleccionar ganadores:", error);

      // No mostrar error de timeout al usuario, solo loguearlo
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.message.includes("timeout") ||
          error.message.includes("timed out") ||
          error.message.includes("signal timed out"))
      ) {
        console.warn("Timeout al seleccionar ganadores");
        return {
          success: false,
          error:
            "El servidor está tardando más de lo esperado. Por favor intenta de nuevo.",
        };
      }

      let errorMessage = "Error desconocido al seleccionar ganadores";

      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "Sin conexión a internet o servidor no disponible";
      } else if (
        error instanceof Error &&
        !error.message.includes("timeout") &&
        !error.message.includes("timed out")
      ) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Obtiene premios activos filtrados
   * @param activeOnly - Si solo obtener premios activos (por defecto true)
   * @returns Promise con los premios filtrados
   */
  async getPremiosActivos(activeOnly: boolean = true): Promise<{
    success: boolean;
    premios?: Premio[];
    error?: string;
  }> {
    const apiResponse = await this.fetchPremios();

    if (!apiResponse.success || !apiResponse.data) {
      return {
        success: false,
        error: apiResponse.error || "No se pudieron obtener los premios",
      };
    }

    const filteredPremios = activeOnly
      ? apiResponse.data.filter((premio) => premio.activo === true)
      : apiResponse.data;

    if (filteredPremios.length === 0) {
      return {
        success: false,
        error: activeOnly
          ? "No hay premios activos disponibles"
          : "No hay premios disponibles",
      };
    }

    return {
      success: true,
      premios: filteredPremios,
    };
  }

  /**
   * Obtiene un premio por su ID
   * @param premioId - ID del premio
   * @returns Promise con el premio encontrado
   */
  async getPremioById(premioId: number): Promise<{
    success: boolean;
    premio?: Premio;
    error?: string;
  }> {
    const apiResponse = await this.fetchPremios();

    if (!apiResponse.success || !apiResponse.data) {
      return {
        success: false,
        error: apiResponse.error || "No se pudieron obtener los premios",
      };
    }

    const premio = apiResponse.data.find((p) => p.id === premioId);

    if (!premio) {
      return {
        success: false,
        error: `No se encontró el premio con ID ${premioId}`,
      };
    }

    return {
      success: true,
      premio,
    };
  }
}

// Exportar una instancia singleton del servicio
export const boletosService = new BoletosService();

// También exportar la clase para casos donde se necesite una nueva instancia
export default BoletosService;
