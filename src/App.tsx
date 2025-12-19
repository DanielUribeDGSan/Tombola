import { useState, useRef, useEffect, useCallback } from "react";
import { Play, RotateCcw, Trophy, Sparkles } from "lucide-react";
import Lottie from "lottie-react";
import { Autocomplete, TextField } from "@mui/material";
import confettiAnimation from "./assets/confeti/confeti.json";
import AudioRuleta from "./assets/mp3/ruleta1.mp3";
import AudioFelicitacion from "./assets/mp3/congratulations.mp3";

// Datos estáticos de regalos
const REGALOS = [
  { id: 1, name: "Aguinaldo 1" },
  { id: 2, name: "Aguinaldo 2" },
  { id: 3, name: "Aguinaldo 3" },
  { id: 4, name: "Aguinaldo 4" },
  { id: 5, name: "Aguinaldo 5" },
  { id: 6, name: "Changuito lanza agua" },
  { id: 7, name: "Tetera" },
  { id: 8, name: "Jugetes" },
  { id: 9, name: "Bocina" },
  { id: 10, name: "Cafetera" },
  { id: 11, name: "Reloj inteligente" },
];

// Datos estáticos de ganadores
const GANADORES_INICIALES = [
  { id: 1, name: "Luz María" },
  { id: 2, name: "Francisco Uribe" },
  { id: 3, name: "Claudia Uribe" },
  { id: 4, name: "Salvador Uribe" },
  { id: 5, name: "Rodrigo Calderón" },
  { id: 6, name: "Vero" },
  { id: 7, name: "Rodrigo Uribe" },
  { id: 8, name: "Matías" },
  { id: 9, name: "Diego" },
  { id: 10, name: "Mariana" },
  { id: 11, name: "Javier Uribe" },
  { id: 12, name: "Raquel" },
  { id: 13, name: "Kevin" },
  { id: 14, name: "Brayan" },
  { id: 15, name: "Sergio Uribe" },
  { id: 16, name: "Daniel Uribe" },
  { id: 17, name: "Adilene" },
];

interface Premio {
  id: number;
  nombre: string;
  cantidad_ganadores: number;
  activo: boolean;
}

interface Ganador {
  id: number;
  nombre: string;
  numero_participante: string;
}

interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: string;
  name: string;
}

interface GanadorConPremio extends Ganador {
  premioNombre?: string;
  premioId?: number;
}

function App() {
  const SPIN_DURATION = 9000;
  const WINNER_WAIT_DURATION = 1000;
  const TOMBOLA_RADIUS = 180 + 30;
  const BALL_RADIUS = 18;
  const GRAVITY = 0.12;
  const FRICTION = 0.98;
  const BOUNCE_DAMPING = 0.75;

  const [isSpinning, setIsSpinning] = useState(false);
  const [isWaitingForWinner, setIsWaitingForWinner] = useState(false);
  const [currentWinners, setCurrentWinners] = useState<Ganador[]>([]);
  const [currentPremioNombre, setCurrentPremioNombre] = useState<string>("");
  const [winners, setWinners] = useState<GanadorConPremio[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);

  // Estados para premios (mutable para poder quitar premios ganados)
  const [premios, setPremios] = useState<Premio[]>(
    REGALOS.map((regalo) => ({
      id: regalo.id,
      nombre: regalo.name,
      cantidad_ganadores: 1, // Cada premio tiene 1 ganador
      activo: true,
    }))
  );
  const [selectedPremioId, setSelectedPremioId] = useState<number | null>(null);
  const [ganadoresDisponibles, setGanadoresDisponibles] = useState<
    typeof GANADORES_INICIALES
  >([...GANADORES_INICIALES]);

  const [apiError, setApiError] = useState<string>("");

  const tombolaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const congratulationsAudioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const isSpinningRef = useRef(false);

  // Función para seleccionar un premio
  const handlePremioSelection = useCallback(
    (premioId: string) => {
      if (!isSpinning && !isWaitingForWinner) {
        const id = premioId && premioId !== "" ? parseInt(premioId) : null;

        if (!id || id === null) {
          setCurrentWinners([]);
          setCurrentPremioNombre("");
        }

        setSelectedPremioId(id);
        setApiError("");
      }
    },
    [isSpinning, isWaitingForWinner]
  );

  // Función para manejar cuando un ganador no está presente
  const handleGanadorNoEsta = useCallback(() => {
    if (currentWinners.length === 0) {
      console.warn("No hay ganadores actuales para eliminar");
      return;
    }

    // Obtener el premioId del ganador más reciente que coincida
    // Buscar desde el final (más reciente) hacia el inicio
    let premioIdDelGanador: number | undefined;

    for (let i = winners.length - 1; i >= 0; i--) {
      const w = winners[i];
      if (currentWinners.some((cw) => cw.id === w.id)) {
        premioIdDelGanador = w.premioId;
        break;
      }
    }

    if (!premioIdDelGanador) {
      console.error("No se pudo encontrar el premioId del ganador", {
        currentWinners,
        winnersLength: winners.length,
        winners: winners.slice(-5), // últimos 5 para debug
      });
      return;
    }

    console.log("Eliminando ganador y reactivando premio", {
      premioId: premioIdDelGanador,
      ganadoresIds: currentWinners.map((cw) => cw.id),
    });

    // Remover ganadores de la lista histórica (winners)
    setWinners((prev) => {
      const nuevos = prev.filter(
        (w) =>
          !(
            w.premioId === premioIdDelGanador &&
            currentWinners.some((cw) => cw.id === w.id)
          )
      );
      console.log("Winners actualizados", {
        antes: prev.length,
        despues: nuevos.length,
      });
      return nuevos;
    });

    // Reactivar el premio
    setPremios((prev) => {
      const nuevos = prev.map((premio) =>
        premio.id === premioIdDelGanador ? { ...premio, activo: true } : premio
      );
      const premioReactivado = nuevos.find((p) => p.id === premioIdDelGanador);
      console.log("Premio reactivado", premioReactivado);
      return nuevos;
    });

    // Limpiar estados actuales
    setCurrentWinners([]);
    setCurrentPremioNombre("");
    setSelectedPremioId(null);
    setApiError("");
  }, [currentWinners, winners]);

  // Función para seleccionar ganadores aleatoriamente
  const seleccionarGanadores = useCallback(
    (premioId: number): Ganador[] => {
      const RELOJ_INTELIGENTE_ID = 11;
      const ADILENE_ID = 17;

      // Si es el reloj inteligente, solo Adilene puede ganar
      if (premioId === RELOJ_INTELIGENTE_ID) {
        const adilene = ganadoresDisponibles.find((g) => g.id === ADILENE_ID);
        if (adilene) {
          return [
            {
              id: adilene.id,
              nombre: adilene.name,
              numero_participante: adilene.id.toString(),
            },
          ];
        }
        return [];
      }

      // Para otros premios, Adilene NO debe estar disponible
      const ganadoresElegibles = ganadoresDisponibles.filter(
        (g) => g.id !== ADILENE_ID
      );

      if (ganadoresElegibles.length === 0) {
        return [];
      }

      // Seleccionar un ganador aleatorio
      const indiceAleatorio = Math.floor(
        Math.random() * ganadoresElegibles.length
      );
      const ganadorSeleccionado = ganadoresElegibles[indiceAleatorio];

      return [
        {
          id: ganadorSeleccionado.id,
          nombre: ganadorSeleccionado.name,
          numero_participante: ganadorSeleccionado.id.toString(),
        },
      ];
    },
    [ganadoresDisponibles]
  );

  // Detectar colisiones entre bolas
  const handleBallCollisions = (ballArray: Ball[]) => {
    for (let i = 0; i < ballArray.length; i++) {
      for (let j = i + 1; j < ballArray.length; j++) {
        const ball1 = ballArray[i];
        const ball2 = ballArray[j];

        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ball1.radius + ball2.radius) {
          const overlap = ball1.radius + ball2.radius - distance;
          const separateX = (dx / distance) * (overlap / 2);
          const separateY = (dy / distance) * (overlap / 2);

          ball1.x -= separateX * 1.5;
          ball1.y -= separateY * 1.5;
          ball2.x += separateX * 1.5;
          ball2.y += separateY * 1.5;

          // Calcular velocidad relativa
          const relativeVx = ball2.vx - ball1.vx;
          const relativeVy = ball2.vy - ball1.vy;
          const relativeSpeed =
            relativeVx * (dx / distance) + relativeVy * (dy / distance);

          // Solo procesar colisión si se están acercando
          if (relativeSpeed < 0) {
            const impulse = 2 * relativeSpeed;
            ball1.vx += (dx / distance) * impulse * BOUNCE_DAMPING;
            ball1.vy += (dy / distance) * impulse * BOUNCE_DAMPING;
            ball2.vx -= (dx / distance) * impulse * BOUNCE_DAMPING;
            ball2.vy -= (dy / distance) * impulse * BOUNCE_DAMPING;

            // Agregar variación aleatoria MUY fuerte en todas las direcciones después de colisión
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI * 2;
            const strength1 = 3 + Math.random() * 3;
            const strength2 = 3 + Math.random() * 3;
            ball1.vx += Math.cos(angle1) * strength1;
            ball1.vy += Math.sin(angle1) * strength1;
            ball2.vx += Math.cos(angle2) * strength2;
            ball2.vy += Math.sin(angle2) * strength2;
          }
        }
      }
    }
  };

  // Actualizar física de las bolas
  const updateBalls = useCallback(() => {
    if (!isSpinningRef.current) return;

    setBalls((prevBalls) => {
      const newBalls = prevBalls.map((ball) => {
        const newBall = { ...ball };

        const centerX = TOMBOLA_RADIUS;
        const centerY = TOMBOLA_RADIUS;

        const dxFromCenter = newBall.x - centerX;
        const dyFromCenter = newBall.y - centerY;
        const distanceFromCenter = Math.sqrt(
          dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter
        );
        const normalizedDistance = distanceFromCenter / TOMBOLA_RADIUS;

        // Fuerza constante hacia el centro cuando están lejos (fuerza centrípeta)
        // Aplicar SIEMPRE que estén lejos del centro para mantener movimiento hacia el centro
        if (distanceFromCenter > 15) {
          const centripetalForce = 0.6 * (0.5 + normalizedDistance * 0.5);
          newBall.vx -= (dxFromCenter / distanceFromCenter) * centripetalForce;
          newBall.vy -= (dyFromCenter / distanceFromCenter) * centripetalForce;
        }

        // Si está muy lejos del centro, fuerza MUY fuerte hacia el centro
        if (distanceFromCenter > TOMBOLA_RADIUS * 0.5) {
          const strongCentripetalForce = 0.8 + normalizedDistance * 0.4;
          newBall.vx -=
            (dxFromCenter / distanceFromCenter) * strongCentripetalForce;
          newBall.vy -=
            (dyFromCenter / distanceFromCenter) * strongCentripetalForce;
        }

        // Agregar variación aleatoria constante y fuerte en todas las direcciones
        const randomAngle = Math.random() * Math.PI * 2;
        const randomStrength = 1.5 + Math.random() * 1.5;
        newBall.vx += Math.cos(randomAngle) * randomStrength;
        newBall.vy += Math.sin(randomAngle) * randomStrength;

        // Rebotes desde el centro: más frecuentes y fuertes
        // Si está cerca del centro, SIEMPRE agregar fuerza para rebotar hacia afuera
        if (distanceFromCenter < TOMBOLA_RADIUS * 0.6) {
          const centerBounceAngle = Math.random() * Math.PI * 2;
          // Fuerza más fuerte cuanto más cerca del centro
          const proximityFactor =
            1 - distanceFromCenter / (TOMBOLA_RADIUS * 0.6);
          const centerBounceStrength =
            (3 + Math.random() * 3) * (0.5 + proximityFactor);
          newBall.vx += Math.cos(centerBounceAngle) * centerBounceStrength;
          newBall.vy += Math.sin(centerBounceAngle) * centerBounceStrength;
        }

        // Rebote periódico desde el centro para mantener distribución
        // Cada cierto tiempo, empujar desde el centro sin importar la distancia
        if (Math.random() > 0.7) {
          const periodicBounceAngle = Math.random() * Math.PI * 2;
          const periodicBounceStrength = 2 + Math.random() * 2;
          newBall.vx += Math.cos(periodicBounceAngle) * periodicBounceStrength;
          newBall.vy += Math.sin(periodicBounceAngle) * periodicBounceStrength;
        }

        prevBalls.forEach((otherBall) => {
          if (otherBall.id !== ball.id) {
            const dx = newBall.x - otherBall.x;
            const dy = newBall.y - otherBall.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 55 && distance > 0) {
              const separationForce = 1.5;
              newBall.vx += (dx / distance) * separationForce;
              newBall.vy += (dy / distance) * separationForce;

              // Agregar impulso aleatorio adicional en colisiones
              const collisionAngle = Math.random() * Math.PI * 2;
              const collisionStrength = 1 + Math.random() * 1.5;
              newBall.vx += Math.cos(collisionAngle) * collisionStrength;
              newBall.vy += Math.sin(collisionAngle) * collisionStrength;
            }
          }
        });

        // Gravedad variable: si está en la parte superior, empujar hacia abajo más fuerte
        // Si está en la parte inferior, empujar menos o invertir
        const isInUpperHalf = newBall.y < centerY;
        const isInLowerHalf = newBall.y > centerY;

        if (isInUpperHalf) {
          // Si está arriba, aplicar MUCHO más gravedad para que baje
          newBall.vy += GRAVITY * 2.5;
          // También agregar impulso aleatorio fuerte hacia abajo y lados
          newBall.vy += 1.0 + Math.random() * 1.0;
          newBall.vx += (Math.random() - 0.5) * 2.0;
        } else if (isInLowerHalf && distanceFromCenter > TOMBOLA_RADIUS * 0.3) {
          // Si está abajo y lejos del centro, empujar hacia arriba
          newBall.vy -= GRAVITY * 0.8;
        } else {
          // Gravedad normal
          newBall.vy += GRAVITY;
        }

        // Si está muy arriba, agregar impulso MUY fuerte hacia abajo y hacia el centro
        if (newBall.y < centerY - 20) {
          newBall.vy += 2.5 + Math.random() * 1.5;
          // Impulso fuerte hacia el centro
          if (distanceFromCenter > 15) {
            newBall.vx -= (dxFromCenter / distanceFromCenter) * 1.5;
            newBall.vy -= (dyFromCenter / distanceFromCenter) * 1.5;
          }
          // Impulso aleatorio adicional hacia abajo
          newBall.vy += 1.0 + Math.random() * 1.0;
        }

        // Si está en la parte superior (arriba del 30% superior), empujar constantemente hacia abajo
        if (newBall.y < centerY - 10) {
          newBall.vy += 0.8 + Math.random() * 0.5;
        }

        // Si está en los bordes (cerca del perímetro), empujar más fuerte hacia el centro
        if (distanceFromCenter > TOMBOLA_RADIUS * 0.7) {
          const edgeCentripetalForce = 1.0;
          newBall.vx -=
            (dxFromCenter / distanceFromCenter) * edgeCentripetalForce;
          newBall.vy -=
            (dyFromCenter / distanceFromCenter) * edgeCentripetalForce;
        }

        newBall.vx *= FRICTION;
        newBall.vy *= FRICTION;

        newBall.x += newBall.vx;
        newBall.y += newBall.vy;

        const maxDistance = TOMBOLA_RADIUS - newBall.radius - 8;

        if (distanceFromCenter > maxDistance) {
          const angle = Math.atan2(dyFromCenter, dxFromCenter);
          newBall.x = centerX + Math.cos(angle) * maxDistance;
          newBall.y = centerY + Math.sin(angle) * maxDistance;

          const normalX = Math.cos(angle);
          const normalY = Math.sin(angle);
          const dotProduct = newBall.vx * normalX + newBall.vy * normalY;

          newBall.vx = (newBall.vx - 2 * dotProduct * normalX) * BOUNCE_DAMPING;
          newBall.vy = (newBall.vy - 2 * dotProduct * normalY) * BOUNCE_DAMPING;

          // Agregar variación aleatoria MUY fuerte en el rebote para direcciones variadas
          const bounceAngle = Math.random() * Math.PI * 2;
          const bounceStrength = 4 + Math.random() * 4;
          newBall.vx += Math.cos(bounceAngle) * bounceStrength;
          newBall.vy += Math.sin(bounceAngle) * bounceStrength;

          // Agregar un segundo impulso aleatorio para más variación
          const secondBounceAngle = Math.random() * Math.PI * 2;
          const secondBounceStrength = 2 + Math.random() * 2;
          newBall.vx += Math.cos(secondBounceAngle) * secondBounceStrength;
          newBall.vy += Math.sin(secondBounceAngle) * secondBounceStrength;
        }

        return newBall;
      });

      handleBallCollisions(newBalls);
      return newBalls;
    });
  }, [TOMBOLA_RADIUS, GRAVITY, FRICTION, BOUNCE_DAMPING]);

  // Loop de animación
  useEffect(() => {
    const animate = () => {
      updateBalls();
      if (isSpinningRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isSpinning) {
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpinning, updateBalls]);

  // Limpiar bolas cuando no está girando
  useEffect(() => {
    if (!isSpinning && !isWaitingForWinner) {
      setBalls([]);
    }
  }, [isSpinning, isWaitingForWinner]);

  // FUNCIÓN PRINCIPAL MODIFICADA - spinTombola
  const spinTombola = useCallback(() => {
    // Validación estricta: no permitir girar si no hay premio seleccionado
    if (!selectedPremioId || selectedPremioId === null) {
      setApiError(
        "⚠️ Por favor selecciona un premio antes de girar la tombola"
      );
      return;
    }

    // Validar que no esté girando o esperando ganadores
    if (isSpinning || isWaitingForWinner) {
      return;
    }
    setCurrentWinners([]);
    setCurrentPremioNombre("");

    setApiError(""); // Limpiar errores previos

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.log("No se pudo reproducir el audio:", error);
      });
    }

    setIsSpinning(true);
    isSpinningRef.current = true;

    // Crear adornos navideños para la animación
    setBalls((prevBalls) => {
      if (prevBalls.length === 0) {
        // Colores navideños realistas
        const christmasColors = [
          "#DC2626", // Rojo navideño
          "#16A34A", // Verde navideño
          "#FBBF24", // Dorado
          "#E5E7EB", // Plateado
          "#1E40AF", // Azul navideño
          "#DC2626", // Rojo
          "#16A34A", // Verde
          "#F59E0B", // Ámbar
          "#7C3AED", // Púrpura
          "#EC4899", // Rosa
          "#06B6D4", // Cyan
          "#F97316", // Naranja
        ];

        // Tipos de formas navideñas
        const ornamentTypes = ["sphere", "cookie", "star", "bell", "snowflake"];

        return Array.from({ length: 40 }, (_, index) => {
          const angle = (index * 137.5) % 360;
          const radius = 20 + (index % 5) * 10;
          const centerX = TOMBOLA_RADIUS;
          const centerY = TOMBOLA_RADIUS;
          const x = centerX + Math.cos((angle * Math.PI) / 180) * radius;
          const y = centerY + Math.sin((angle * Math.PI) / 180) * radius;

          // Velocidades iniciales más variadas y lentas en todas las direcciones
          const initialAngle = Math.random() * Math.PI * 2;
          const initialSpeed = 5 + Math.random() * 8;

          return {
            id: `ornament-${index}`,
            x,
            y,
            vx: Math.cos(initialAngle) * initialSpeed,
            vy: Math.sin(initialAngle) * initialSpeed,
            radius: BALL_RADIUS,
            color: christmasColors[index % christmasColors.length],
            type: ornamentTypes[index % ornamentTypes.length],
            name: String.fromCharCode(65 + (index % 26)),
          };
        });
      }
      const christmasColors = [
        "#DC2626",
        "#16A34A",
        "#FBBF24",
        "#E5E7EB",
        "#1E40AF",
        "#DC2626",
        "#16A34A",
        "#F59E0B",
        "#7C3AED",
        "#EC4899",
        "#06B6D4",
        "#F97316",
      ];
      const ornamentTypes = ["sphere", "cookie", "star", "bell", "snowflake"];

      return prevBalls.map((ball, index) => {
        // Velocidades variadas en todas las direcciones
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 8;

        return {
          ...ball,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: christmasColors[index % christmasColors.length],
          type: ornamentTypes[index % ornamentTypes.length],
        };
      });
    });

    if (tombolaRef.current) {
      tombolaRef.current.style.transform = "rotate(1080deg)";
      tombolaRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    // Después del tiempo de giro, obtener los ganadores
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      isSpinningRef.current = false;
      setIsSpinning(false);
      setIsWaitingForWinner(true);

      if (tombolaRef.current) {
        tombolaRef.current.style.transform = "rotate(0deg)";
        tombolaRef.current.style.transition = "";
      }

      if (selectedPremioId) {
        // Seleccionar ganadores usando la lógica local
        const ganadores = seleccionarGanadores(selectedPremioId);

        if (ganadores.length === 0) {
          setIsWaitingForWinner(false);
          setApiError("No hay ganadores disponibles para este premio");
          return;
        }

        // Esperar antes de mostrar los ganadores
        setTimeout(() => {
          setIsWaitingForWinner(false);
          setCurrentWinners(ganadores);

          // Obtener el nombre del premio seleccionado
          const premioSeleccionado = premios.find(
            (p) => p.id === selectedPremioId
          );
          const nombrePremio = premioSeleccionado?.nombre || "";
          setCurrentPremioNombre(nombrePremio);

          // Guardar el premioId antes de limpiarlo
          const premioIdGanado = selectedPremioId;

          // Guardar ganadores con información del premio
          const ganadoresConPremio: GanadorConPremio[] = ganadores.map(
            (ganador) => ({
              ...ganador,
              premioNombre: nombrePremio,
              premioId: premioIdGanado || undefined,
            })
          );
          setWinners((prev) => [...prev, ...ganadoresConPremio]);

          // Remover ganadores de la lista de disponibles
          setGanadoresDisponibles((prev) =>
            prev.filter((g) => !ganadores.some((gan) => gan.id === g.id))
          );

          // Desactivar el premio ganado
          setPremios((prev) =>
            prev.map((premio) =>
              premio.id === premioIdGanado
                ? { ...premio, activo: false }
                : premio
            )
          );

          // NO limpiar la selección del premio todavía, se limpiará cuando se haga click en "No está" o cuando se reinicie

          setShowConfetti(true);

          if (congratulationsAudioRef.current) {
            congratulationsAudioRef.current.currentTime = 0;
            congratulationsAudioRef.current.play().catch((error) => {
              console.log(
                "No se pudo reproducir el audio de felicitación:",
                error
              );
            });
          }

          // Solo quitar confetti después de 5 segundos
          setTimeout(() => {
            setShowConfetti(false);
          }, 5000);
        }, WINNER_WAIT_DURATION);
      }
    }, SPIN_DURATION);
  }, [
    isSpinning,
    isWaitingForWinner,
    selectedPremioId,
    premios,
    SPIN_DURATION,
    WINNER_WAIT_DURATION,
    seleccionarGanadores,
    TOMBOLA_RADIUS,
    BALL_RADIUS,
  ]);

  const resetGame = useCallback(() => {
    if (!isSpinning && !isWaitingForWinner) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (congratulationsAudioRef.current) {
        congratulationsAudioRef.current.pause();
        congratulationsAudioRef.current.currentTime = 0;
      }

      setWinners([]);
      setCurrentWinners([]);
      setShowConfetti(false);
      setBalls([]);
      setSelectedPremioId(null);
      setApiError("");
      setGanadoresDisponibles([...GANADORES_INICIALES]);
      // Reactivar todos los premios
      setPremios(
        REGALOS.map((regalo) => ({
          id: regalo.id,
          nombre: regalo.name,
          cantidad_ganadores: 1,
          activo: true,
        }))
      );
      isSpinningRef.current = false;
    }
  }, [isSpinning, isWaitingForWinner]);

  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if (
        e.key === " " &&
        !isSpinning &&
        !isWaitingForWinner &&
        selectedPremioId !== null
      ) {
        e.preventDefault();
        spinTombola();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyPress);
    return () => window.removeEventListener("keydown", handleGlobalKeyPress);
  }, [selectedPremioId, isSpinning, isWaitingForWinner, spinTombola]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (congratulationsAudioRef.current) {
        congratulationsAudioRef.current.pause();
        congratulationsAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-purple-600  pb-5">
      {/* Lottie Confetti Animation */}
      {showConfetti && (
        <div className="confetti-overlay">
          <Lottie
            animationData={confettiAnimation}
            style={{ width: "100%", height: "100%" }}
            loop={false}
            autoplay={true}
          />
        </div>
      )}

      <section>
        <div className="container px-2 px-md-4 pt-5">
          {/* <div className="text-center pt-3 pb-3 mb-1 mb-md-1">
            <img
              src={LogoImage}
              className="object-contain logo-image"
              alt="tombola logo"
            />
          </div> */}

          {/* Mostrar error de API si existe */}
          {apiError && (
            <div className="row justify-content-center mb-3">
              <div className="col-12 col-md-8 col-lg-6">
                <div
                  className="alert alert-danger alert-dismissible fade show"
                  role="alert"
                >
                  <strong>Error:</strong> {apiError}
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setApiError("")}
                    aria-label="Close"
                  ></button>
                </div>
              </div>
            </div>
          )}

          <div className="row g-3 g-lg-4">
            {/* Columna Izquierda - Tombola Grande */}
            <div className="col-12 col-lg-7 order-2 order-lg-1">
              <div className="card shadow-lg border-0 rounded-4 ">
                <div className="card-body p-3 p-md-4 p-lg-5 text-center d-flex flex-column align-items-center justify-content-center">
                  <div className="d-flex justify-content-center align-items-center mb-4 mb-md-5">
                    <div className="christmas-ornament-container">
                      {/* Hilo de la esfera de Navidad */}
                      <div className="christmas-ornament-hook"></div>
                      <div
                        ref={tombolaRef}
                        className="tombola-wheel christmas-ornament"
                        style={{
                          transition: "transform 0.5s ease",
                          position: "relative",
                          overflow: "hidden",
                          width: `${TOMBOLA_RADIUS * 2}px`,
                          height: `${TOMBOLA_RADIUS * 2}px`,
                        }}
                      >
                        <div className="position-absolute tombola-inner">
                          {isSpinning &&
                            balls.map((ball) => (
                              <div
                                key={ball.id}
                                className={`christmas-ornament christmas-ornament-${ball.type}`}
                                style={
                                  {
                                    position: "absolute",
                                    left: `${ball.x - BALL_RADIUS}px`,
                                    top: `${ball.y - BALL_RADIUS}px`,
                                    width: `${BALL_RADIUS * 2}px`,
                                    height: `${BALL_RADIUS * 2}px`,
                                    transform: `translate3d(0, 0, 0)`,
                                    "--ornament-color": ball.color,
                                  } as React.CSSProperties
                                }
                              >
                                {ball.type === "sphere" && (
                                  <>
                                    <div className="ornament-sphere" />
                                    <div className="ornament-shine" />
                                    <div className="ornament-hook-small" />
                                  </>
                                )}
                                {ball.type === "cookie" && (
                                  <>
                                    <div className="ornament-cookie" />
                                    <div className="cookie-decoration cookie-decoration-1" />
                                    <div className="cookie-decoration cookie-decoration-2" />
                                    <div className="cookie-decoration cookie-decoration-3" />
                                  </>
                                )}
                                {ball.type === "star" && (
                                  <>
                                    <div className="ornament-star" />
                                    <div className="star-shine" />
                                  </>
                                )}
                                {ball.type === "bell" && (
                                  <>
                                    <div className="ornament-bell" />
                                    <div className="bell-clapper" />
                                  </>
                                )}
                                {ball.type === "snowflake" && (
                                  <>
                                    <div className="ornament-snowflake" />
                                  </>
                                )}
                              </div>
                            ))}
                          {!isSpinning && (
                            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                              <div className="text-center">
                                <Sparkles
                                  size={48}
                                  className="mb-2 opacity-50"
                                />
                                <p className="small mb-0">
                                  Selecciona un premio
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="tombola-center-icon">
                          <Sparkles
                            className={`text-white ${
                              isSpinning || isWaitingForWinner
                                ? "animate-spin"
                                : ""
                            }`}
                            size={window.innerWidth < 576 ? 32 : 40}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estado de espera del ganador */}
                  {isWaitingForWinner && (
                    <div className="alert alert-info border-0 rounded-4 p-3 p-md-4 mb-4">
                      <div className="d-flex align-items-center justify-content-center gap-3 mb-2">
                        <div
                          className="spinner-border text-primary"
                          role="status"
                          style={{ width: "1.5rem", height: "1.5rem" }}
                        >
                          <span className="visually-hidden">Cargando...</span>
                        </div>
                        <span className="fs-5 fw-medium">
                          Procesando los ganadores...
                        </span>
                      </div>
                      <p className="small text-muted mb-0">
                        ⏳ Los ganadores se mostrarán en unos segundos
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      // Validación adicional antes de girar
                      if (!selectedPremioId || selectedPremioId === null) {
                        setApiError(
                          "⚠️ Por favor selecciona un premio antes de girar la tombola"
                        );
                        return;
                      }
                      spinTombola();
                    }}
                    disabled={
                      selectedPremioId === null ||
                      selectedPremioId === undefined ||
                      !selectedPremioId ||
                      isSpinning ||
                      isWaitingForWinner
                    }
                    className={`btn w-100 py-3 py-md-4 rounded-4 fw-bold fs-5 fs-md-4 ${
                      selectedPremioId !== null &&
                      selectedPremioId !== undefined &&
                      selectedPremioId &&
                      !isSpinning &&
                      !isWaitingForWinner
                        ? "btn-primary btn-glow"
                        : "btn-secondary"
                    }`}
                    title={
                      !selectedPremioId || selectedPremioId === null
                        ? "Selecciona un premio para habilitar el giro"
                        : "Girar la tombola"
                    }
                  >
                    <div className="d-flex align-items-center justify-content-center gap-2 gap-md-3">
                      <Play
                        className={
                          isSpinning || isWaitingForWinner ? "animate-spin" : ""
                        }
                        size={window.innerWidth < 576 ? 20 : 24}
                      />
                      {isSpinning
                        ? "¡Girando la Magia!"
                        : isWaitingForWinner
                        ? "Esperando ganadores..."
                        : "¡GIRAR TOMBOLA!"}
                    </div>
                  </button>

                  <button
                    onClick={resetGame}
                    disabled={isSpinning || isWaitingForWinner}
                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 mx-auto mt-3"
                  >
                    <RotateCcw size={16} />
                    Reiniciar Todo
                  </button>
                </div>
              </div>
            </div>

            {/* Columna Derecha - Premios y Ganadores */}
            <div className="col-12 col-lg-5 order-1 order-lg-2">
              <div className="card shadow-lg border-0 rounded-4 mb-3 mb-md-4">
                <div className="card-body p-3">
                  <div>
                    <div>
                      <label className="form-label small fw-medium mb-2 d-block">
                        Seleccionar premio:
                        {premios.filter((p) => p.activo).length === 0 && (
                          <span className="text-muted small d-block mt-1">
                            (Todos los premios han sido ganados)
                          </span>
                        )}
                      </label>
                      <Autocomplete
                        options={premios.filter((p) => p.activo)}
                        getOptionLabel={(option) => option.nombre}
                        value={
                          premios.find((p) => p.id === selectedPremioId) || null
                        }
                        onChange={(_, newValue) => {
                          handlePremioSelection(
                            newValue ? newValue.id.toString() : ""
                          );
                        }}
                        disabled={isSpinning || isWaitingForWinner}
                        isOptionEqualToValue={(option, value) =>
                          option.id === value.id
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Buscar y seleccionar un premio..."
                            variant="outlined"
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "0.5rem",
                                backgroundColor: "white",
                                fontSize: "1rem",
                                padding: "12px 14px",
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#cd040a",
                                },
                                "&.Mui-focused .MuiOutlinedInput-notchedOutline":
                                  {
                                    borderColor: "#cd040a",
                                    borderWidth: "2px",
                                  },
                              },
                              "& .MuiInputLabel-root.Mui-focused": {
                                color: "#cd040a",
                              },
                            }}
                          />
                        )}
                        sx={{
                          "& .MuiAutocomplete-inputRoot": {
                            fontSize: "1rem",
                          },
                        }}
                        componentsProps={{
                          popper: {
                            sx: {
                              "& .MuiPaper-root": {
                                animation: "none !important",
                                transition:
                                  "opacity 0.15s ease-in-out !important",
                                transform: "none !important",
                              },
                            },
                          },
                        }}
                        noOptionsText="No se encontraron premios"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {currentWinners.length > 0 && (
                <div className="alert alert-success border-0 rounded-4 p-3 p-md-4 mb-4 winner-celebration animate-bounce">
                  <div className="d-flex align-items-center justify-content-center gap-2 gap-md-3 mb-3">
                    <Trophy size={window.innerWidth < 576 ? 24 : 32} />
                    <div
                      style={{
                        fontSize: window.innerWidth < 576 ? "1.5rem" : "2rem",
                      }}
                    >
                      🎉
                    </div>
                    <Trophy size={window.innerWidth < 576 ? 24 : 32} />
                  </div>
                  {currentPremioNombre && (
                    <div className="mb-2 text-center w-100">
                      <span className="premio-badge d-block">
                        {currentPremioNombre}
                      </span>
                    </div>
                  )}
                  <h3 className="fs-4 fs-md-3 fw-bold mb-2 text-center">
                    {currentWinners.length === 1
                      ? "¡FELICITACIONES!"
                      : "¡FELICITACIONES A LOS GANADORES!"}
                  </h3>
                  {currentWinners.map((ganador, index) => (
                    <div
                      key={ganador.id}
                      className="mb-3 p-3 bg-white bg-opacity-50 rounded-3"
                    >
                      <p className="fs-4 fs-md-3 fw-bold mb-2 text-center">
                        #{ganador.numero_participante} - {ganador.nombre}
                      </p>
                      {currentPremioNombre && (
                        <p className="small text-muted mb-1 text-center">
                          Premio: {currentPremioNombre}
                        </p>
                      )}
                      {index < currentWinners.length - 1 && (
                        <hr className="my-3" />
                      )}
                    </div>
                  ))}
                  <div className="mt-3 d-flex flex-column gap-2">
                    <button
                      onClick={handleGanadorNoEsta}
                      style={{
                        border: "1px solid #fff",
                      }}
                      className="btn btn-outline-danger btn-sm d-flex align-items-center justify-content-center gap-2"
                    >
                      <span className="text-white">No está</span>
                    </button>
                  </div>
                  <div className="mt-2 small opacity-75 text-center">
                    🌟 ¡Increíble suerte! 🌟
                  </div>
                </div>
              )}

              {/* Panel de Premio Seleccionado */}
              {selectedPremioId && (
                <div className="card shadow-lg border-0 rounded-4 mb-3 mb-lg-4">
                  <div className="card-body p-3 p-md-4">
                    <div className="d-flex align-items-center gap-2 gap-md-3 mb-3 mb-md-4">
                      <Trophy
                        className="text-warning"
                        size={window.innerWidth < 576 ? 20 : 24}
                      />
                      <h2 className="fs-4 fs-md-3 fw-bold text-dark mb-0 flex-grow-1">
                        Premio Seleccionado
                      </h2>
                    </div>
                    {(() => {
                      const premio = premios.find(
                        (p) => p.id === selectedPremioId
                      );
                      return premio ? (
                        <div className="p-3 bg-light rounded-3">
                          <p className="fw-bold text-dark mb-0">
                            {premio.nombre}
                          </p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Panel de Ganadores */}
              <div className="card shadow-lg border-0 rounded-4">
                <div className="card-body p-3 p-md-4">
                  <div className="d-flex align-items-center gap-2 gap-md-3 mb-3 mb-md-4">
                    <Trophy
                      className="text-warning"
                      size={window.innerWidth < 576 ? 20 : 24}
                    />
                    <h2 className="fs-4 fs-md-3 fw-bold text-dark mb-0 flex-grow-1">
                      Ganadores
                    </h2>
                    <span className="badge bg-warning rounded-pill">
                      {winners.length}
                    </span>
                  </div>

                  <div className="winners-list">
                    {[...winners].reverse().map((winner, index) => (
                      <div
                        key={`${winner.id}-${index}`}
                        className="d-flex align-items-center gap-2 gap-md-3 p-3 p-md-4 bg-warning bg-opacity-10 border border-warning rounded-3 mb-2 mb-md-3 winner-item-hover"
                      >
                        <div className="winner-position">{index + 1}</div>
                        <div className="flex-grow-1">
                          <p className="fw-bold text-dark mb-1">
                            #{winner.numero_participante} - {winner.nombre}
                          </p>
                          {winner.premioNombre && (
                            <p className="small text-muted mb-0">
                              Premio: {winner.premioNombre}
                            </p>
                          )}
                        </div>
                        <Trophy
                          className="text-warning"
                          size={window.innerWidth < 576 ? 16 : 20}
                        />
                      </div>
                    ))}
                    {winners.length === 0 && (
                      <div className="text-center py-4 py-md-5 text-muted">
                        <Trophy
                          className="mb-3 opacity-50"
                          size={window.innerWidth < 576 ? 48 : 64}
                        />
                        <p className="mb-1">Aún no hay ganadores</p>
                        <p className="small mb-0">
                          ¡Gira la tombola para comenzar!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audio Elements */}
      <audio ref={audioRef} preload="auto" style={{ display: "none" }} loop>
        <source src={AudioRuleta} type="audio/mpeg" />
        <source src="/assets/ruleta1.wav" type="audio/wav" />
        Tu navegador no soporta audio.
      </audio>

      <audio
        ref={congratulationsAudioRef}
        preload="auto"
        style={{ display: "none" }}
      >
        <source src={AudioFelicitacion} type="audio/mpeg" />
        <source src="/assets/mp3/congratulations.wav" type="audio/wav" />
        Tu navegador no soporta audio.
      </audio>
    </div>
  );
}

export default App;
