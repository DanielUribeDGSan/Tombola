import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Play,
  Plus,
  Trash2,
  RotateCcw,
  Trophy,
  Users,
  Sparkles,
  Star,
  Download,
  RefreshCw,
  List,
} from "lucide-react";
import Lottie from "lottie-react";
import confettiAnimation from "./assets/confeti/confeti.json";
import AudioRuleta from "./assets/mp3/ruleta1.mp3";
import AudioFelicitacion from "./assets/mp3/congratulations.mp3";
import { boletosService, type Boleto } from "./api/fetch";

import BackgroundImage from "./assets/img/back-dinamica.png";
import LogoImage from "./assets/img/logo_1.png";

interface Participant {
  id: string;
  name: string;
  color: string;
  category: number;
}

interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  name: string;
}

interface CategoryData {
  name: string;
  boletos: Boleto[];
  participants: Participant[];
}

function App() {
  const SPIN_DURATION = 3000;
  const WINNER_WAIT_DURATION = 1000; // 4 segundos adicionales para mostrar el ganador
  const TOMBOLA_RADIUS = 180 + 30;
  const BALL_RADIUS = 18;
  const GRAVITY = 0.15;
  const FRICTION = 0.985;
  const BOUNCE_DAMPING = 0.9;

  // Estados existentes
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [isWaitingForWinner, setIsWaitingForWinner] = useState(false); // Nuevo estado
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winnerBallAnimation, setWinnerBallAnimation] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [isLoadingRulete, setIsLoadingRulete] = useState(false);

  // Nuevos estados para boletos
  const [categories, setCategories] = useState<Record<string, CategoryData>>(
    {}
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loadingBoletos, setLoadingBoletos] = useState(false);
  const [boletosError, setBoletosError] = useState<string>("");

  const [apiError, setApiError] = useState<string>(""); // Nuevo estado para errores de API

  const tombolaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const congratulationsAudioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const isSpinningRef = useRef(false);

  const colors = [
    "#EF4444",
    "#F97316",
    "#F59E0B",
    "#84CC16",
    "#22C55E",
    "#06B6D4",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#F43F5E",
  ];

  // Función para convertir boletos a participantes
  const convertBoletosToParticipants = useCallback(
    (boletos: Boleto[]): Participant[] => {
      return boletos
        .filter((boleto) => boleto.activo === 1)
        .map((boleto, index) => ({
          id: boleto.numero_boleto,
          name: boleto.nombre_usuario,
          color: colors[index % colors.length],
          category: Number(selectedCategory),
        }));
    },
    [colors, selectedCategory]
  );

  // Cargar boletos desde la API
  const loadBoletos = useCallback(async () => {
    setLoadingBoletos(true);
    setBoletosError("");

    try {
      const response = await boletosService.fetchBoletos();

      if (response.success && response.data) {
        const categoriesData: Record<string, CategoryData> = {};

        Object.entries(response.data).forEach(([categoryId, boletos]) => {
          const participants = convertBoletosToParticipants(boletos);
          categoriesData[categoryId] = {
            name: `Categoría ${categoryId}`,
            boletos,
            participants,
          };
        });

        setCategories(categoriesData);
      } else {
        setBoletosError(response.error || "Error al cargar boletos");
      }
    } catch (error) {
      setBoletosError("Error de conexión al cargar boletos");
      console.error("Error loading boletos:", error);
    } finally {
      setLoadingBoletos(false);
    }
  }, [convertBoletosToParticipants]);

  // Cargar boletos al montar el componente
  useEffect(() => {
    loadBoletos();
  }, []);

  // Función para cargar participantes de una categoría
  const loadParticipantsFromCategory = useCallback(
    (categoryId: string) => {
      if (categories[categoryId] && !isSpinning && !isWaitingForWinner) {
        setParticipants(categories[categoryId].participants);
        setSelectedCategory(categoryId);

        setApiError("");
      }
    },
    [categories, isSpinning, isWaitingForWinner]
  );

  // Calcular posiciones iniciales
  const ballPositions = useMemo(() => {
    return participants.map((_, index) => {
      const angle = (index * 137.5) % 360;
      const radius = 20 + (index % 3) * 12;
      const centerX = 50;
      const centerY = 50;

      const x = centerX + Math.cos((angle * Math.PI) / 180) * radius;
      const y = centerY + Math.sin((angle * Math.PI) / 180) * radius;

      const maxRadius = 42;
      const distanceFromCenter = Math.sqrt(
        (x - centerX) ** 2 + (y - centerY) ** 2
      );

      if (distanceFromCenter > maxRadius) {
        const scale = maxRadius / distanceFromCenter;
        return {
          x: centerX + (x - centerX) * scale,
          y: centerY + (y - centerY) * scale,
        };
      }

      return { x, y };
    });
  }, [participants.length]);

  // Inicializar bolas físicas
  const initializeBalls = useCallback(() => {
    const newBalls: Ball[] = participants.map((participant, index) => {
      const position = ballPositions[index];
      const x = (position.x / 100) * (TOMBOLA_RADIUS * 2);
      const y = (position.y / 100) * (TOMBOLA_RADIUS * 2);

      return {
        id: participant.id,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: BALL_RADIUS,
        color: participant.color,
        name: participant.name,
      };
    });
    setBalls(newBalls);
  }, [participants, ballPositions]);

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

          const tempVx = ball1.vx;
          const tempVy = ball1.vy;
          ball1.vx = ball2.vx * BOUNCE_DAMPING + (Math.random() - 0.5) * 2;
          ball1.vy = ball2.vy * BOUNCE_DAMPING + (Math.random() - 0.5) * 2;
          ball2.vx = tempVx * BOUNCE_DAMPING + (Math.random() - 0.5) * 2;
          ball2.vy = tempVy * BOUNCE_DAMPING + (Math.random() - 0.5) * 2;
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
        const centrifugalForce = 0.8;

        const dxFromCenter = newBall.x - centerX;
        const dyFromCenter = newBall.y - centerY;

        newBall.vx += (dxFromCenter / TOMBOLA_RADIUS) * centrifugalForce;
        newBall.vy += (dyFromCenter / TOMBOLA_RADIUS) * centrifugalForce;

        newBall.vx += (Math.random() - 0.5) * 1.5;
        newBall.vy += (Math.random() - 0.5) * 1.5;

        prevBalls.forEach((otherBall) => {
          if (otherBall.id !== ball.id) {
            const dx = newBall.x - otherBall.x;
            const dy = newBall.y - otherBall.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 80) {
              const separationForce = 0.3;
              newBall.vx += (dx / distance) * separationForce;
              newBall.vy += (dy / distance) * separationForce;
            }
          }
        });

        newBall.vy += GRAVITY;

        newBall.vx *= FRICTION;
        newBall.vy *= FRICTION;

        newBall.x += newBall.vx;
        newBall.y += newBall.vy;

        const distanceFromCenter = Math.sqrt(
          dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter
        );
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

          newBall.vx += (Math.random() - 0.5) * 3;
          newBall.vy += (Math.random() - 0.5) * 3;
        }

        return newBall;
      });

      handleBallCollisions(newBalls);
      return newBalls;
    });
  }, []);

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

  // Inicializar bolas cuando cambian los participantes
  useEffect(() => {
    if (!isSpinning && !isWaitingForWinner) {
      initializeBalls();
    }
  }, [participants, initializeBalls, isSpinning, isWaitingForWinner]);

  // FUNCIÓN PRINCIPAL MODIFICADA - spinTombola
  const spinTombola = useCallback(() => {
    if (participants.length < 2 || isSpinning || isWaitingForWinner) return;

    // Validar que en modo boletos se haya seleccionado una categoría
    if (!selectedCategory) {
      setApiError("Por favor selecciona una categoría antes de girar");
      return;
    }
    setIsLoadingRulete(false);
    setCurrentWinner(null);

    setApiError(""); // Limpiar errores previos

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.log("No se pudo reproducir el audio:", error);
      });
    }

    setIsSpinning(true);
    isSpinningRef.current = true;
    // No limpiar currentWinner aquí - se mantiene visible hasta que haya un nuevo ganador
    setWinnerBallAnimation(false);

    setBalls((prevBalls) =>
      prevBalls.map((ball, index) => ({
        ...ball,
        vx: (Math.random() - 0.5) * 15 + Math.cos(index * 2) * 5,
        vy: (Math.random() - 0.5) * 15 + Math.sin(index * 2) * 5,
      }))
    );

    if (tombolaRef.current) {
      tombolaRef.current.style.transform = "rotate(1080deg)";
      tombolaRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    // Después del tiempo de giro, obtener el ganador
    setTimeout(async () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      isSpinningRef.current = false;
      setIsSpinning(false);
      setIsWaitingForWinner(true); // Mostrar estado de espera

      if (tombolaRef.current) {
        tombolaRef.current.style.transform = "rotate(0deg)";
        tombolaRef.current.style.transition = "";
      }

      let winner: Participant | null = null;

      try {
        if (selectedCategory) {
          // Usar el servicio API para obtener el ganador
          const nivel = parseInt(selectedCategory);
          const response = await boletosService.seleccionarBoleto(nivel);

          if (response.success && response.data) {
            // Crear el objeto ganador con los datos del servicio
            const winnerColor =
              colors[Math.floor(Math.random() * colors.length)];

            winner = {
              id: response.data.boleto,
              name: response.data.usuario,
              color: winnerColor,
              category: nivel,
            };
          } else {
            throw new Error(
              response.error || "Error al seleccionar boleto desde el servidor"
            );
          }
        } else {
          // Modo manual - selección aleatoria local
          winner =
            participants[Math.floor(Math.random() * participants.length)];
        }

        if (!winner) {
          throw new Error("No se pudo determinar un ganador");
        }

        // Esperar 4 segundos adicionales antes de mostrar el ganador
        setTimeout(async () => {
          setIsWaitingForWinner(false);
          setCurrentWinner(winner); // Aquí se limpia el anterior y se establece el nuevo
          setIsLoadingRulete(true);
          setWinners((prev) => [...prev, winner!]);

          setWinnerBallAnimation(true);
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

          // Recargar datos del servidor después del ganador (solo en modo boletos)

          try {
            await loadBoletos();
            // Recargar participantes de la categoría actual después de actualizar
            if (selectedCategory && categories[selectedCategory]) {
              setTimeout(() => {
                loadParticipantsFromCategory(selectedCategory);
              }, 100);
            }
          } catch (error) {
            console.error(
              "Error al recargar boletos después del ganador:",
              error
            );
          }

          // Solo quitar confetti y animación de pelota después de 5 segundos
          // El currentWinner se mantiene hasta el próximo giro
          setTimeout(() => {
            setShowConfetti(false);
            setWinnerBallAnimation(false);
          }, 5000);
        }, WINNER_WAIT_DURATION);
      } catch (error) {
        console.error("Error al obtener ganador:", error);
        setIsWaitingForWinner(false);
        setApiError(
          error instanceof Error
            ? error.message
            : "Error desconocido al obtener ganador"
        );
      }
    }, SPIN_DURATION);
  }, [
    participants,
    isSpinning,
    isWaitingForWinner,
    selectedCategory,
    colors,
    SPIN_DURATION,
    WINNER_WAIT_DURATION,
    loadBoletos,
    categories,
    loadParticipantsFromCategory,
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

      setParticipants([]);
      setWinners([]);
      setCurrentWinner(null);
      setShowConfetti(false);
      setWinnerBallAnimation(false);
      setBalls([]);
      setSelectedCategory("");
      setApiError("");
      setIsLoadingRulete(false);
      isSpinningRef.current = false;
    }
  }, [isSpinning, isWaitingForWinner]);

  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if (
        e.key === " " &&
        !isSpinning &&
        !isWaitingForWinner &&
        participants.length >= 2
      ) {
        e.preventDefault();
        spinTombola();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyPress);
    return () => window.removeEventListener("keydown", handleGlobalKeyPress);
  }, [participants.length, isSpinning, isWaitingForWinner, spinTombola]);

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
    <div
      className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-purple-600  "
      style={{
        backgroundImage: `url('${BackgroundImage}') `,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
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
        <div className="container px-2 px-md-4">
          <div className="text-center mb-1 mb-md-1">
            <img
              src={LogoImage}
              className="object-contain logo-image"
              alt="tombola logo"
            />
          </div>

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
              <div className="card shadow-lg border-0 rounded-4 h-100">
                <div className="card-body p-3 p-md-4 p-lg-5 text-center d-flex flex-column align-items-center justify-content-center">
                  <div className="d-flex justify-content-center align-items-center mb-4 mb-md-5">
                    <div
                      ref={tombolaRef}
                      className="tombola-wheel"
                      style={{
                        background: "linear-gradient(145deg, #e2e8f0, #cbd5e1)",
                        borderRadius: "50%",
                        border: "0.5rem solid #64748b",
                        boxShadow:
                          "inset 0 8px 16px rgba(0,0,0,0.2), 0 16px 64px rgba(0,0,0,0.3)",
                        transition: "transform 0.5s ease",
                        position: "relative",
                        overflow: "hidden",
                        width: `${TOMBOLA_RADIUS * 2}px`,
                        height: `${TOMBOLA_RADIUS * 2}px`,
                      }}
                    >
                      <div className="position-absolute tombola-inner">
                        {(isSpinning
                          ? balls
                          : participants.map((participant, index) => {
                              const position = ballPositions[index];
                              return {
                                id: participant.id,
                                x: (position.x / 100) * (TOMBOLA_RADIUS * 2),
                                y: (position.y / 100) * (TOMBOLA_RADIUS * 2),
                                color: participant.color,
                                name: participant.name,
                              };
                            })
                        ).map((ball) => {
                          const isWinnerBall =
                            currentWinner && ball.id === currentWinner.id;

                          return (
                            <div
                              key={ball.id}
                              className={`participant-ball ${
                                isSpinning
                                  ? ""
                                  : isWinnerBall && winnerBallAnimation
                                  ? "animate-ping winner-glow"
                                  : "animate-pulse"
                              }`}
                              style={{
                                backgroundColor: ball.color,
                                position: "absolute",
                                left: `${ball.x - BALL_RADIUS}px`,
                                top: `${ball.y - BALL_RADIUS}px`,
                                width: `${BALL_RADIUS * 2}px`,
                                height: `${BALL_RADIUS * 2}px`,
                                transform: `${
                                  isWinnerBall && winnerBallAnimation
                                    ? "scale(1.5)"
                                    : "scale(1)"
                                }`,
                                zIndex:
                                  isWinnerBall && winnerBallAnimation ? 10 : 1,
                                boxShadow:
                                  isWinnerBall && winnerBallAnimation
                                    ? `0 0 25px ${ball.color}`
                                    : "0 5px 10px rgba(0,0,0,0.3)",
                                transition: isSpinning
                                  ? "none"
                                  : "all 0.3s ease",
                              }}
                            >
                              <div className="participant-ball-content">
                                <span className="participant-initial">
                                  {ball.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
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
                          Procesando el ganador...
                        </span>
                      </div>
                      <p className="small text-muted mb-0">
                        ⏳ El ganador se mostrará en unos segundos
                      </p>
                    </div>
                  )}

                  <button
                    onClick={spinTombola}
                    disabled={
                      participants.length < 2 ||
                      isSpinning ||
                      isWaitingForWinner
                    }
                    className={`btn w-100 py-3 py-md-4 rounded-4 fw-bold fs-5 fs-md-4 ${
                      participants.length >= 2 &&
                      !isSpinning &&
                      !isWaitingForWinner
                        ? "btn-primary btn-glow"
                        : "btn-secondary"
                    }`}
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
                        ? "Esperando ganador..."
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

            {/* Columna Derecha - Participantes y Ganadores */}
            <div className="col-12 col-lg-5 order-1 order-lg-2">
              <div className="card shadow-lg border-0 rounded-4 mb-3 mb-md-4">
                <div className="card-body p-3">
                  <div>
                    {loadingBoletos && (
                      <div className="text-center py-3">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></div>
                        Cargando boletos...
                      </div>
                    )}

                    {boletosError && (
                      <div className="alert alert-danger small mb-3">
                        {boletosError}
                      </div>
                    )}

                    {Object.keys(categories).length > 0 && (
                      <div>
                        <label className="form-label small fw-medium">
                          Seleccionar categoría:
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) =>
                            loadParticipantsFromCategory(e.target.value)
                          }
                          disabled={
                            isSpinning || isWaitingForWinner || loadingBoletos
                          }
                          className="form-select form-select-lg"
                        >
                          <option value="">
                            -- Selecciona una categoría --
                          </option>
                          {Object.entries(categories).map(([id, category]) => (
                            <option key={id} value={id}>
                              {category.name} ({category.participants.length}{" "}
                              participantes activos)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isLoadingRulete && currentWinner && (
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
                  <h3 className="fs-4 fs-md-3 fw-bold mb-2 text-center">
                    ¡FELICITACIONES!
                  </h3>
                  <p className="fs-3 fs-md-2 fw-bold mb-2 text-center">
                    {currentWinner.name}
                  </p>

                  <p className="small text-muted mb-2 text-center">
                    Boleto: {currentWinner.id}
                  </p>
                  <p className="small text-muted mb-2 text-center">
                    Categoría: {currentWinner.category}
                  </p>

                  <div className="d-flex align-items-center justify-content-center gap-2 fs-6 fs-md-5">
                    <span>¡Eres el ganador!</span>
                    <div
                      className="rounded-circle border border-2 border-white"
                      style={{
                        backgroundColor: currentWinner.color,
                        width: window.innerWidth < 576 ? "12px" : "16px",
                        height: window.innerWidth < 576 ? "12px" : "16px",
                      }}
                    />
                  </div>
                  <div className="mt-2 small opacity-75 text-center">
                    🌟 ¡Increíble suerte! 🌟
                  </div>
                </div>
              )}

              {/* Panel de Participantes */}
              <div className="card shadow-lg border-0 rounded-4 mb-3 mb-lg-4">
                <div className="card-body p-3 p-md-4">
                  <div className="d-flex align-items-center gap-2 gap-md-3 mb-3 mb-md-4">
                    <Users
                      className="text-primary"
                      size={window.innerWidth < 576 ? 20 : 24}
                    />
                    <h2 className="fs-4 fs-md-3 fw-bold text-dark mb-0 flex-grow-1">
                      Participantes
                    </h2>
                    <span className="badge bg-primary rounded-pill">
                      {participants.length}
                    </span>
                    {selectedCategory && (
                      <span className="badge bg-info rounded-pill small">
                        Cat. {selectedCategory}
                      </span>
                    )}
                  </div>

                  <div className="participants-list">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="d-flex align-items-center justify-content-between p-2 p-md-3 bg-light rounded-3 mb-2 participant-item-hover"
                      >
                        <div className="d-flex align-items-center gap-2 gap-md-3">
                          <div
                            className="rounded-circle border border-2 border-white shadow-sm participant-color"
                            style={{ backgroundColor: participant.color }}
                          />
                          <div className="flex-grow-1">
                            <span className="fw-medium text-dark participant-name d-block">
                              {participant.name}
                            </span>

                            <small className="text-muted">
                              {participant.id}
                            </small>
                          </div>
                        </div>
                      </div>
                    ))}
                    {participants.length === 0 && (
                      <div className="text-center py-4 py-md-5 text-muted">
                        <Users
                          className="mb-3 opacity-50"
                          size={window.innerWidth < 576 ? 48 : 64}
                        />
                        <p className="mb-1">No hay participantes aún</p>
                        <p className="small mb-0">
                          Selecciona una categoría de boletos
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                    {winners.map((winner, index) => (
                      <div
                        key={`${winner.id}-${index}`}
                        className="d-flex align-items-center gap-2 gap-md-3 p-3 p-md-4 bg-warning bg-opacity-10 border border-warning rounded-3 mb-2 mb-md-3 winner-item-hover"
                      >
                        <div className="winner-position">
                          {winners.length - index}
                        </div>
                        <div className="flex-grow-1">
                          <p className="fw-bold text-dark mb-1">
                            {winner.name}
                          </p>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle border border-white shadow-sm winner-color"
                              style={{ backgroundColor: winner.color }}
                            />
                            <span className="small text-muted">
                              Ronda {winners.length - index}
                            </span>

                            <span className="small text-muted">
                              • {winner.id}
                            </span>
                            <span className="small text-muted">
                              Categoría: {winner.category}
                            </span>
                          </div>
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
