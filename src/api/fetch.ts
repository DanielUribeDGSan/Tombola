// services/boletosService.ts

export interface Boleto {
  numero_boleto: string;
  nombre_usuario: string;
  activo: number;
}

export interface BoletosResponse {
  [key: string]: Boleto[];
}

export interface ApiResponse {
  success: boolean;
  data?: BoletosResponse;
  error?: string;
}

class BoletosService {
  private readonly baseUrl = "https://www.aspid50.com/api";

  /**
   * Obtiene todos los boletos desde la API
   * @returns Promise con la respuesta de la API
   */
  async fetchBoletos(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/boletos`, {
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

      const data: BoletosResponse = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Error al obtener boletos:", error);

      let errorMessage = "Error desconocido al cargar boletos";

      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "Sin conexión a internet o servidor no disponible";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Obtiene boletos de una categoría específica y filtrados por estado activo
   * @param category - Categoría de boletos (1, 2, 3, etc.)
   * @param activeOnly - Si solo obtener boletos activos (por defecto true)
   * @returns Promise con los boletos filtrados
   */
  async getBoletosByCategory(
    category: string,
    activeOnly: boolean = true
  ): Promise<{
    success: boolean;
    boletos?: Boleto[];
    error?: string;
  }> {
    const apiResponse = await this.fetchBoletos();

    if (!apiResponse.success || !apiResponse.data) {
      return {
        success: false,
        error: apiResponse.error || "No se pudieron obtener los boletos",
      };
    }

    const categoryBoletos = apiResponse.data[category];

    if (!categoryBoletos || !Array.isArray(categoryBoletos)) {
      return {
        success: false,
        error: `No se encontraron boletos para la categoría ${category}`,
      };
    }

    const filteredBoletos = activeOnly
      ? categoryBoletos.filter((boleto) => boleto.activo === 1)
      : categoryBoletos;

    if (filteredBoletos.length === 0) {
      return {
        success: false,
        error: activeOnly
          ? `No hay boletos activos en la categoría ${category}`
          : `No hay boletos en la categoría ${category}`,
      };
    }

    return {
      success: true,
      boletos: filteredBoletos,
    };
  }

  /**
   * Obtiene todas las categorías disponibles
   * @returns Promise con las categorías encontradas
   */
  async getAvailableCategories(): Promise<{
    success: boolean;
    categories?: string[];
    error?: string;
  }> {
    const apiResponse = await this.fetchBoletos();

    if (!apiResponse.success || !apiResponse.data) {
      return {
        success: false,
        error: apiResponse.error || "No se pudieron obtener las categorías",
      };
    }

    const categories = Object.keys(apiResponse.data).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    return {
      success: true,
      categories,
    };
  }

  /**
   * Obtiene estadísticas de boletos por categoría
   * @returns Promise con estadísticas
   */
  async getBoletosStats(): Promise<{
    success: boolean;
    stats?: {
      category: string;
      total: number;
      active: number;
      inactive: number;
    }[];
    error?: string;
  }> {
    const apiResponse = await this.fetchBoletos();

    if (!apiResponse.success || !apiResponse.data) {
      return {
        success: false,
        error: apiResponse.error || "No se pudieron obtener las estadísticas",
      };
    }

    const stats = Object.entries(apiResponse.data).map(
      ([category, boletos]) => {
        const active = boletos.filter((b) => b.activo === 1).length;
        const inactive = boletos.filter((b) => b.activo === 0).length;

        return {
          category,
          total: boletos.length,
          active,
          inactive,
        };
      }
    );

    return {
      success: true,
      stats,
    };
  }
}

// Exportar una instancia singleton del servicio
export const boletosService = new BoletosService();

// También exportar la clase para casos donde se necesite una nueva instancia
export default BoletosService;
