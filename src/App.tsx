import { useState, useRef, useEffect, useCallback } from "react";
import { Play, RotateCcw, Trophy, Sparkles } from "lucide-react";
import Lottie from "lottie-react";
import { Autocomplete, TextField } from "@mui/material";
import confettiAnimation from "./assets/confeti/confeti.json";
import AudioRuleta from "./assets/mp3/ruleta1.mp3";
import AudioFelicitacion from "./assets/mp3/congratulations.mp3";
import { boletosService, type Premio, type Ganador } from "./api/fetch";

import BackgroundImage from "./assets/img/fondo.png";
import LogoImage from "./assets/img/logo.png";

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

interface GanadorConPremio extends Ganador {
  premioNombre?: string;
  premioId?: number;
}

function App() {
  const SPIN_DURATION = 9000;
  const WINNER_WAIT_DURATION = 1000; // 4 segundos adicionales para mostrar el ganador
  const TOMBOLA_RADIUS = 180 + 30;
  const BALL_RADIUS = 18;
  const GRAVITY = 0.15;
  const FRICTION = 0.985;
  const BOUNCE_DAMPING = 0.9;

  const [isSpinning, setIsSpinning] = useState(false);
  const [isWaitingForWinner, setIsWaitingForWinner] = useState(false); // Nuevo estado
  const [currentWinners, setCurrentWinners] = useState<Ganador[]>([]);
  const [currentPremioNombre, setCurrentPremioNombre] = useState<string>("");
  const [winners, setWinners] = useState<GanadorConPremio[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);

  // Nuevos estados para premios
  const [premios, setPremios] = useState<Premio[]>([]);
  const [selectedPremioId, setSelectedPremioId] = useState<number | null>(null);
  const [loadingPremios, setLoadingPremios] = useState(false);
  const [premiosError, setPremiosError] = useState<string>("");

  const [apiError, setApiError] = useState<string>(""); // Nuevo estado para errores de API

  const tombolaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const congratulationsAudioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const isSpinningRef = useRef(false);

  // Ref para evitar peticiones duplicadas
  const isLoadingPremiosRef = useRef(false);

  // Ref para mantener el premio seleccionado actual sin causar re-renders
  const selectedPremioIdRef = useRef<number | null>(null);

  // Ref para evitar limpiar ganadores cuando se recargan premios automáticamente
  const isReloadingPremiosRef = useRef(false);

  // Actualizar ref cuando cambia selectedPremioId y limpiar estados relacionados
  useEffect(() => {
    selectedPremioIdRef.current = selectedPremioId;

    // Solo limpiar ganadores si NO estamos recargando premios automáticamente
    // y el usuario explícitamente deseleccionó el premio
    if (
      (selectedPremioId === null || selectedPremioId === undefined) &&
      !isReloadingPremiosRef.current
    ) {
      setCurrentWinners([]);
      setCurrentPremioNombre("");
      setApiError(""); // Limpiar errores cuando se deselecciona
    }
  }, [selectedPremioId]);

  // Cargar premios desde la API
  const loadPremios = useCallback(async (silent = false) => {
    // Evitar peticiones duplicadas
    if (isLoadingPremiosRef.current) {
      return;
    }

    isLoadingPremiosRef.current = true;

    if (!silent) {
      setLoadingPremios(true);
    }
    setPremiosError("");

    try {
      const response = await boletosService.fetchPremios();

      if (response.success && response.data) {
        // Filtrar solo premios activos
        const premiosActivos = response.data.filter((premio) => premio.activo);
        setPremios(premiosActivos);
        setPremiosError(""); // Limpiar errores previos si hay éxito

        // Validar que el premio seleccionado siga activo después de recargar
        const premioIdActual = selectedPremioIdRef.current;
        if (premioIdActual !== null && premioIdActual !== undefined) {
          const premioSeleccionadoExiste = premiosActivos.some(
            (premio) => premio.id === premioIdActual
          );
          // Si el premio seleccionado ya no está activo o no existe, limpiar la selección
          // pero NO limpiar los ganadores actuales si están siendo mostrados
          if (!premioSeleccionadoExiste) {
            isReloadingPremiosRef.current = true;
            setSelectedPremioId(null);
            setApiError("");
            // Resetear la bandera después de un breve delay
            setTimeout(() => {
              isReloadingPremiosRef.current = false;
            }, 100);
          }
        }
      } else if (response.error) {
        // Solo mostrar error si existe y no es un timeout
        setPremiosError(response.error);
      } else {
        // Si no hay error explícito, limpiar errores previos
        setPremiosError("");
      }
    } catch (error) {
      setPremiosError("Error de conexión al cargar premios");
      console.error("Error loading premios:", error);
    } finally {
      if (!silent) {
        setLoadingPremios(false);
      }
      isLoadingPremiosRef.current = false;
    }
  }, []);

  // Cargar premios al montar el componente (solo una vez)
  useEffect(() => {
    loadPremios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar una vez al montar

  // Función para seleccionar un premio
  const handlePremioSelection = useCallback(
    (premioId: string) => {
      if (!isSpinning && !isWaitingForWinner) {
        // Si se selecciona el valor vacío, establecer como null explícitamente
        const id = premioId && premioId !== "" ? parseInt(premioId) : null;

        // Si se deselecciona el premio explícitamente, limpiar ganadores
        if (!id || id === null) {
          isReloadingPremiosRef.current = false; // Asegurar que no estamos en modo recarga
          setCurrentWinners([]);
          setCurrentPremioNombre("");
        }

        setSelectedPremioId(id);
        setApiError(""); // Limpiar errores al cambiar selección
      }
    },
    [isSpinning, isWaitingForWinner]
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

    // Crear regalos genéricos para la animación (más cantidad para simular más elementos)
    setBalls((prevBalls) => {
      if (prevBalls.length === 0) {
        // Aumentar a 50 regalos para simular más cantidad
        const giftColors = [
          "#EF4444", // Rojo
          "#F97316", // Naranja
          "#F59E0B", // Ámbar
          "#84CC16", // Lima
          "#22C55E", // Verde
          "#06B6D4", // Cyan
          "#3B82F6", // Azul
          "#8B5CF6", // Violeta
          "#EC4899", // Rosa
          "#F43F5E", // Rose
          "#10B981", // Esmeralda
          "#14B8A6", // Teal
          "#6366F1", // Índigo
          "#A855F7", // Púrpura
          "#F472B6", // Rosa claro
          "#FB7185", // Rose claro
        ];

        return Array.from({ length: 50 }, (_, index) => {
          const angle = (index * 137.5) % 360;
          const radius = 20 + (index % 5) * 10;
          const centerX = TOMBOLA_RADIUS;
          const centerY = TOMBOLA_RADIUS;
          const x = centerX + Math.cos((angle * Math.PI) / 180) * radius;
          const y = centerY + Math.sin((angle * Math.PI) / 180) * radius;

          return {
            id: `gift-${index}`,
            x,
            y,
            vx: (Math.random() - 0.5) * 15 + Math.cos(index * 2) * 5,
            vy: (Math.random() - 0.5) * 15 + Math.sin(index * 2) * 5,
            radius: BALL_RADIUS,
            color: giftColors[index % giftColors.length],
            name: String.fromCharCode(65 + (index % 26)),
          };
        });
      }
      return prevBalls.map((ball, index) => ({
        ...ball,
        vx: (Math.random() - 0.5) * 15 + Math.cos(index * 2) * 5,
        vy: (Math.random() - 0.5) * 15 + Math.sin(index * 2) * 5,
      }));
    });

    if (tombolaRef.current) {
      tombolaRef.current.style.transform = "rotate(1080deg)";
      tombolaRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    // Después del tiempo de giro, obtener los ganadores
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

      try {
        if (selectedPremioId) {
          // Usar el servicio API para obtener los ganadores
          const response = await boletosService.seleccionarGanadores(
            selectedPremioId
          );

          if (response.success && response.data && response.data.ganadores) {
            const ganadores = response.data.ganadores;

            if (ganadores.length === 0) {
              throw new Error("No se obtuvieron ganadores");
            }

            // Esperar antes de mostrar los ganadores
            setTimeout(async () => {
              setIsWaitingForWinner(false);
              setCurrentWinners(ganadores);

              // Obtener el nombre del premio seleccionado
              const premioSeleccionado = premios.find(
                (p) => p.id === selectedPremioId
              );
              const nombrePremio = premioSeleccionado?.nombre || "";
              setCurrentPremioNombre(nombrePremio);

              // Guardar ganadores con información del premio
              const ganadoresConPremio: GanadorConPremio[] = ganadores.map(
                (ganador) => ({
                  ...ganador,
                  premioNombre: nombrePremio,
                  premioId: selectedPremioId || undefined,
                })
              );
              setWinners((prev) => [...prev, ...ganadoresConPremio]);

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

              // Recargar premios después de obtener ganadores para actualizar lista
              // y verificar que el premio seleccionado siga activo
              try {
                await loadPremios(true); // true = silent, no mostrar loading
              } catch (error) {
                console.error(
                  "Error al recargar premios después del giro:",
                  error
                );
              }

              // Solo quitar confetti después de 5 segundos
              setTimeout(() => {
                setShowConfetti(false);
              }, 5000);
            }, WINNER_WAIT_DURATION);
          } else {
            throw new Error(
              response.error ||
                "Error al seleccionar ganadores desde el servidor"
            );
          }
        }
      } catch (error) {
        console.error("Error al obtener ganadores:", error);
        setIsWaitingForWinner(false);
        setApiError(
          error instanceof Error
            ? error.message
            : "Error desconocido al obtener ganadores"
        );
      }
    }, SPIN_DURATION);
  }, [
    isSpinning,
    isWaitingForWinner,
    selectedPremioId,
    premios,
    SPIN_DURATION,
    WINNER_WAIT_DURATION,
    loadPremios,
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
    <div
      className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-purple-600  pb-5"
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
          <div className="text-center pt-3 pb-3 mb-1 mb-md-1">
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
                        {isSpinning &&
                          balls.map((ball) => (
                            <div
                              key={ball.id}
                              className="gift-box"
                              style={{
                                position: "absolute",
                                left: `${ball.x - BALL_RADIUS}px`,
                                top: `${ball.y - BALL_RADIUS}px`,
                                width: `${BALL_RADIUS * 2}px`,
                                height: `${BALL_RADIUS * 2}px`,
                              }}
                            >
                              {/* Caja del regalo */}
                              <div
                                className="gift-box-body"
                                style={{
                                  backgroundImage: `url('${BackgroundImage}')`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  width: "100%",
                                  height: "100%",
                                }}
                              >
                                {/* Líneas decorativas horizontales */}
                                <div
                                  className="gift-stripe gift-stripe-horizontal"
                                  style={{
                                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                                  }}
                                />
                                {/* Líneas decorativas verticales */}
                                <div
                                  className="gift-stripe gift-stripe-vertical"
                                  style={{
                                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                                  }}
                                />
                              </div>
                              {/* Moño superior */}
                              <div className="gift-bow">
                                <div
                                  className="gift-bow-center"
                                  style={{
                                    backgroundColor: ball.color,
                                    filter: "brightness(0.8)",
                                  }}
                                />
                                <div
                                  className="gift-bow-left"
                                  style={{
                                    backgroundColor: ball.color,
                                    filter: "brightness(0.7)",
                                  }}
                                />
                                <div
                                  className="gift-bow-right"
                                  style={{
                                    backgroundColor: ball.color,
                                    filter: "brightness(0.7)",
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        {!isSpinning && (
                          <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                            <div className="text-center">
                              <Sparkles size={48} className="mb-2 opacity-50" />
                              <p className="small mb-0">Selecciona un premio</p>
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
                    {loadingPremios && (
                      <div className="text-center py-3">
                        <div
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                        ></div>
                        Cargando premios...
                      </div>
                    )}

                    {premiosError && (
                      <div className="alert alert-danger small mb-3">
                        {premiosError}
                      </div>
                    )}

                    {premios.length > 0 && (
                      <div>
                        <label className="form-label small fw-medium mb-2 d-block">
                          Seleccionar premio:
                        </label>
                        <Autocomplete
                          options={premios}
                          getOptionLabel={(option) =>
                            `${option.nombre} (${
                              option.cantidad_ganadores
                            } ganador${
                              option.cantidad_ganadores > 1 ? "es" : ""
                            })`
                          }
                          value={
                            premios.find((p) => p.id === selectedPremioId) ||
                            null
                          }
                          onChange={(_, newValue) => {
                            handlePremioSelection(
                              newValue ? newValue.id.toString() : ""
                            );
                          }}
                          disabled={
                            isSpinning || isWaitingForWinner || loadingPremios
                          }
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
                          loadingText="Cargando premios..."
                        />
                      </div>
                    )}
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
                        {ganador.nombre}
                      </p>
                      <p className="small text-muted mb-1 text-center">
                        Participante: {ganador.numero_participante}
                      </p>
                      {index < currentWinners.length - 1 && (
                        <hr className="my-3" />
                      )}
                    </div>
                  ))}
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
                          <p className="fw-bold text-dark mb-2">
                            {premio.nombre}
                          </p>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-primary">
                              {premio.cantidad_ganadores} ganador
                              {premio.cantidad_ganadores > 1 ? "es" : ""}
                            </span>
                          </div>
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
                            {winner.nombre}
                          </p>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="small text-muted">
                              Participante: {winner.numero_participante}
                            </span>
                            {winner.premioNombre && (
                              <>
                                <span className="small text-muted">•</span>
                                <span className="small text-muted fw-medium">
                                  Premio: {winner.premioNombre}
                                </span>
                              </>
                            )}
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
