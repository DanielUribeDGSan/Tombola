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
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  color: string;
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

function App() {
  const SPIN_DURATION = 3000;
  const TOMBOLA_RADIUS = 180; // Radio en pixels para el área de la tombola
  const BALL_RADIUS = 18; // Bolas un poco más pequeñas para más espacio
  const GRAVITY = 0.15; // Reducido para más flotación
  const FRICTION = 0.985; // Menos fricción para más movimiento
  const BOUNCE_DAMPING = 0.9; // Menos amortiguación para más rebotes

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winnerBallAnimation, setWinnerBallAnimation] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);

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

  // Calcular posiciones iniciales (como antes, pero para inicializar bolas)
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
      // Convertir porcentajes a pixeles dentro del área de la tombola
      const x = (position.x / 100) * (TOMBOLA_RADIUS * 2);
      const y = (position.y / 100) * (TOMBOLA_RADIUS * 2);

      return {
        id: participant.id,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 2, // Velocidad inicial aleatoria
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
          // Separar las bolas más agresivamente
          const overlap = ball1.radius + ball2.radius - distance;
          const separateX = (dx / distance) * (overlap / 2);
          const separateY = (dy / distance) * (overlap / 2);

          ball1.x -= separateX * 1.5; // Más separación
          ball1.y -= separateY * 1.5;
          ball2.x += separateX * 1.5;
          ball2.y += separateY * 1.5;

          // Intercambiar velocidades con más energía
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
        let newBall = { ...ball };

        // Aplicar fuerza centrífuga durante el giro
        const centerX = TOMBOLA_RADIUS;
        const centerY = TOMBOLA_RADIUS;
        const centrifugalForce = 0.8; // Aumentado para más movimiento

        const dxFromCenter = newBall.x - centerX;
        const dyFromCenter = newBall.y - centerY;

        // Fuerza centrífuga más fuerte
        newBall.vx += (dxFromCenter / TOMBOLA_RADIUS) * centrifugalForce;
        newBall.vy += (dyFromCenter / TOMBOLA_RADIUS) * centrifugalForce;

        // Mucha más aleatoriedad para separar las bolas
        newBall.vx += (Math.random() - 0.5) * 1.5;
        newBall.vy += (Math.random() - 0.5) * 1.5;

        // Fuerza de separación entre bolas (anti-agrupamiento)
        prevBalls.forEach((otherBall) => {
          if (otherBall.id !== ball.id) {
            const dx = newBall.x - otherBall.x;
            const dy = newBall.y - otherBall.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 80) {
              // Fuerza de separación a distancia
              const separationForce = 0.3;
              newBall.vx += (dx / distance) * separationForce;
              newBall.vy += (dy / distance) * separationForce;
            }
          }
        });

        // Aplicar gravedad
        newBall.vy += GRAVITY;

        // Aplicar fricción
        newBall.vx *= FRICTION;
        newBall.vy *= FRICTION;

        // Actualizar posición
        newBall.x += newBall.vx;
        newBall.y += newBall.vy;

        // Detectar colisiones con las paredes de la tombola (circular)
        const distanceFromCenter = Math.sqrt(
          dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter
        );
        const maxDistance = TOMBOLA_RADIUS - newBall.radius - 8; // 8px por el borde

        if (distanceFromCenter > maxDistance) {
          // Rebote en la pared circular con más energía
          const angle = Math.atan2(dyFromCenter, dxFromCenter);
          newBall.x = centerX + Math.cos(angle) * maxDistance;
          newBall.y = centerY + Math.sin(angle) * maxDistance;

          // Reflejar velocidad con más energía
          const normalX = Math.cos(angle);
          const normalY = Math.sin(angle);
          const dotProduct = newBall.vx * normalX + newBall.vy * normalY;

          newBall.vx = (newBall.vx - 2 * dotProduct * normalX) * BOUNCE_DAMPING;
          newBall.vy = (newBall.vy - 2 * dotProduct * normalY) * BOUNCE_DAMPING;

          // Agregar energía aleatoria en el rebote
          newBall.vx += (Math.random() - 0.5) * 3;
          newBall.vy += (Math.random() - 0.5) * 3;
        }

        return newBall;
      });

      // Manejar colisiones entre bolas
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
    if (!isSpinning) {
      initializeBalls();
    }
  }, [participants, initializeBalls, isSpinning]);

  const addParticipant = useCallback(() => {
    if (newParticipant.trim() && !isSpinning) {
      const participant: Participant = {
        id: Date.now().toString(),
        name: newParticipant.trim(),
        color: colors[participants.length % colors.length],
      };
      setParticipants((prev) => [...prev, participant]);
      setNewParticipant("");
    }
  }, [newParticipant, isSpinning, participants.length, colors]);

  const removeParticipant = useCallback(
    (id: string) => {
      if (!isSpinning) {
        setParticipants((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [isSpinning]
  );

  const spinTombola = useCallback(() => {
    if (participants.length < 2 || isSpinning) return;

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.log("No se pudo reproducir el audio:", error);
      });
    }

    setIsSpinning(true);
    isSpinningRef.current = true;
    setCurrentWinner(null);
    setWinnerBallAnimation(false);

    // Dar impulso inicial a las bolas
    setBalls((prevBalls) =>
      prevBalls.map((ball, index) => ({
        ...ball,
        vx: (Math.random() - 0.5) * 15 + Math.cos(index * 2) * 5, // Más impulso y dirección variada
        vy: (Math.random() - 0.5) * 15 + Math.sin(index * 2) * 5,
      }))
    );

    if (tombolaRef.current) {
      tombolaRef.current.style.transform = "rotate(1080deg)";
      tombolaRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      isSpinningRef.current = false;

      const winner =
        participants[Math.floor(Math.random() * participants.length)];
      setCurrentWinner(winner);
      setWinners((prev) => [...prev, winner]);
      setParticipants((prev) => prev.filter((p) => p.id !== winner.id));
      setIsSpinning(false);
      setWinnerBallAnimation(true);
      setShowConfetti(true);

      if (congratulationsAudioRef.current) {
        congratulationsAudioRef.current.currentTime = 0;
        congratulationsAudioRef.current.play().catch((error) => {
          console.log("No se pudo reproducir el audio de felicitación:", error);
        });
      }

      if (tombolaRef.current) {
        tombolaRef.current.style.transform = "rotate(0deg)";
        tombolaRef.current.style.transition = "";
      }

      setTimeout(() => {
        setShowConfetti(false);
        setWinnerBallAnimation(false);
      }, 5000);
    }, SPIN_DURATION);
  }, [participants, isSpinning, SPIN_DURATION]);

  const resetGame = useCallback(() => {
    if (!isSpinning) {
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
      isSpinningRef.current = false;
    }
  }, [isSpinning]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        addParticipant();
      }
    },
    [addParticipant]
  );

  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " && !isSpinning && participants.length >= 2) {
        e.preventDefault();
        spinTombola();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyPress);
    return () => window.removeEventListener("keydown", handleGlobalKeyPress);
  }, [participants.length, isSpinning, spinTombola]);

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
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-purple-600 p-2 p-md-4 roulette-container">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="confetti-overlay">
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="%23ff6b35"/></svg>\') repeat',
              animation: "confetti-fall 3s linear infinite",
            }}
          />
        </div>
      )}

      <section>
        <div className="container-fluid px-2 px-md-4">
          <div className="text-center mb-4 mb-md-5">
            <h1 className="display-3 display-md-2 fw-bold text-white mb-3 mb-md-4 text-shadow">
              🎊 TOMBOLA MÁGICA 🎊
            </h1>
            <p className="fs-5 fs-md-4 text-white-75 fw-medium mb-2">
              ¡Agrega participantes y gira la tombola para elegir un ganador!
            </p>
            <p className="small text-white-50">
              ⏱️ Tiempo de giro: {SPIN_DURATION / 1000} segundos
            </p>
          </div>

          <div className="row g-3 g-lg-4">
            {/* Columna Izquierda - Tombola Grande */}
            <div className="col-12 col-lg-6 order-2 order-lg-1">
              <div className="card shadow-lg border-0 rounded-4 h-100">
                <div className="card-body p-3 p-md-4 p-lg-5 text-center">
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
                        {/* Mostrar bolas con física durante el giro, posiciones normales cuando no */}
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
                            isSpinning ? "animate-spin" : ""
                          }`}
                          size={window.innerWidth < 576 ? 32 : 40}
                        />
                      </div>
                    </div>
                  </div>

                  {currentWinner && (
                    <div className="alert alert-success border-0 rounded-4 p-3 p-md-4 mb-4 winner-celebration animate-bounce">
                      <div className="d-flex align-items-center justify-content-center gap-2 gap-md-3 mb-3">
                        <Trophy size={window.innerWidth < 576 ? 24 : 32} />
                        <div
                          style={{
                            fontSize:
                              window.innerWidth < 576 ? "1.5rem" : "2rem",
                          }}
                        >
                          🎉
                        </div>
                        <Trophy size={window.innerWidth < 576 ? 24 : 32} />
                      </div>
                      <h3 className="fs-4 fs-md-3 fw-bold mb-2">
                        ¡FELICITACIONES!
                      </h3>
                      <p className="fs-3 fs-md-2 fw-bold mb-2">
                        {currentWinner.name}
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
                      <div className="mt-2 small opacity-75">
                        🌟 ¡Increíble suerte! 🌟
                      </div>
                    </div>
                  )}

                  <button
                    onClick={spinTombola}
                    disabled={participants.length < 2 || isSpinning}
                    className={`btn w-100 py-3 py-md-4 rounded-4 fw-bold fs-5 fs-md-4 ${
                      participants.length >= 2 && !isSpinning
                        ? "btn-primary btn-glow"
                        : "btn-secondary"
                    }`}
                  >
                    <div className="d-flex align-items-center justify-content-center gap-2 gap-md-3">
                      <Play
                        className={isSpinning ? "animate-spin" : ""}
                        size={window.innerWidth < 576 ? 20 : 24}
                      />
                      {isSpinning ? "¡Girando la Magia!" : "¡GIRAR TOMBOLA!"}
                    </div>
                  </button>

                  {participants.length < 2 && (
                    <p className="text-muted mt-2 small">
                      Necesitas al menos 2 participantes
                    </p>
                  )}

                  <p className="text-muted mt-2 small">
                    Presiona ESPACIO para girar rápidamente
                  </p>

                  <button
                    onClick={resetGame}
                    disabled={isSpinning}
                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 mx-auto mt-3"
                  >
                    <RotateCcw size={16} />
                    Reiniciar Todo
                  </button>
                </div>
              </div>
            </div>

            {/* Columna Derecha - Participantes y Ganadores */}
            <div className="col-12 col-lg-6 order-1 order-lg-2">
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
                  </div>

                  <div className="mb-3 mb-md-4">
                    <div className="input-group">
                      <input
                        type="text"
                        value={newParticipant}
                        onChange={(e) => setNewParticipant(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Nombre del participante"
                        className="form-control border-2 rounded-start-3 py-2 py-md-3"
                        disabled={isSpinning}
                      />
                      <button
                        onClick={addParticipant}
                        disabled={!newParticipant.trim() || isSpinning}
                        className="btn btn-success rounded-end-3"
                        type="button"
                      >
                        <Plus size={window.innerWidth < 576 ? 16 : 20} />
                      </button>
                    </div>
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
                          <span className="fw-medium text-dark participant-name">
                            {participant.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeParticipant(participant.id)}
                          disabled={isSpinning}
                          className="btn btn-sm btn-outline-danger remove-btn"
                        >
                          <Trash2 size={window.innerWidth < 576 ? 14 : 16} />
                        </button>
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
                          Agrega al menos 2 para comenzar
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

          <div className="mt-4 mt-md-5 text-center text-white text-opacity-75">
            <p className="mb-0 small">
              💡 <strong>Consejo:</strong> Puedes usar la barra espaciadora para
              girar rápidamente
            </p>
          </div>
        </div>
      </section>

      {/* Audio Elements */}
      <audio ref={audioRef} preload="auto" style={{ display: "none" }} loop>
        <source src="/assets/mp3/ruleta1.mp3" type="audio/mpeg" />
        <source src="/assets/ruleta1.wav" type="audio/wav" />
        Tu navegador no soporta audio.
      </audio>

      <audio
        ref={congratulationsAudioRef}
        preload="auto"
        style={{ display: "none" }}
      >
        <source src="/assets/mp3/congratulations.mp3" type="audio/mpeg" />
        <source src="/assets/mp3/congratulations.wav" type="audio/wav" />
        Tu navegador no soporta audio.
      </audio>

      <style jsx>{`
        /* Reset y utilidades base */
        * {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        /* Clases de utilidad responsivas */
        .text-shadow {
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        .text-white-75 {
          color: rgba(255, 255, 255, 0.9) !important;
        }

        .text-white-50 {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        /* Contenedor principal responsivo */
        .roulette-container {
          background: linear-gradient(
            135deg,
            #ff6b35 0%,
            #f7931e 25%,
            #ec4899 50%,
            #8b5cf6 75%,
            #3b82f6 100%
          ) !important;
          min-height: 100vh;
        }

        /* CONFETTI */
        .confetti-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(720deg);
          }
        }

        /* Tombola responsive */
        .tombola-wheel {
          position: relative;
          overflow: hidden;
        }

        .tombola-inner {
          position: absolute;
          inset: 1rem;
          border-radius: 50%;
        }

        /* Centro de la tombola */
        .tombola-center-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 5rem;
          height: 5rem;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          border-radius: 50%;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
        }

        /* Pelotas de participantes */
        .participant-ball {
          border-radius: 50%;
          border: 2px solid #374151;
          box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .participant-ball-content {
          width: 1.75rem;
          height: 1.75rem;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d1d5db;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .participant-initial {
          font-size: 0.875rem;
          font-weight: 700;
          color: #374151;
          line-height: 1;
        }

        /* Colors de participantes y ganadores */
        .participant-color {
          width: 1rem;
          height: 1rem;
        }

        .winner-color {
          width: 0.75rem;
          height: 0.75rem;
        }

        /* Posición del ganador */
        .winner-position {
          width: 2rem;
          height: 2rem;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        /* Listas con scroll personalizado */
        .participants-list,
        .winners-list {
          max-height: 20rem;
          overflow-y: auto;
        }

        .participants-list::-webkit-scrollbar,
        .winners-list::-webkit-scrollbar {
          width: 6px;
        }

        .participants-list::-webkit-scrollbar-track,
        .winners-list::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }

        .participants-list::-webkit-scrollbar-thumb,
        .winners-list::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .participants-list::-webkit-scrollbar-thumb:hover,
        .winners-list::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Efectos hover */
        .participant-item-hover:hover {
          background-color: #e5e7eb !important;
          transform: translateY(-1px);
        }

        .participant-item-hover:hover .remove-btn {
          opacity: 1;
        }

        .winner-item-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);
        }

        .remove-btn {
          opacity: 0;
          transition: all 0.3s ease;
        }

        /* Efectos de botones */
        .btn-glow:hover {
          box-shadow: 0 8px 25px rgba(13, 110, 253, 0.4);
          transform: translateY(-2px);
        }

        /* Animaciones de celebración */
        .winner-celebration {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .winner-glow {
          box-shadow: 0 0 30px rgba(251, 191, 36, 0.6);
          animation: glow 2s ease-in-out infinite alternate;
        }

        /* Animaciones CSS */
        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes glow {
          from {
            box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
          }
          to {
            box-shadow: 0 0 40px rgba(251, 191, 36, 0.8);
          }
        }

        /* Animaciones existentes de Tailwind */
        .animate-bounce {
          animation: bounce 1s infinite;
        }

        .animate-ping {
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes bounce {
          0%,
          100% {
            transform: translateY(-25%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: none;
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }

        @keyframes ping {
          75%,
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes pulse {
          50% {
            opacity: 0.5;
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Responsive Design */
        @media (max-width: 575.98px) {
          .roulette-container {
            padding: 0.5rem !important;
          }

          .tombola-center-icon {
            width: 3.5rem;
            height: 3.5rem;
          }

          .participant-ball-content {
            width: 1.5rem;
            height: 1.5rem;
          }

          .participant-initial {
            font-size: 0.75rem;
          }

          .participant-color {
            width: 0.75rem;
            height: 0.75rem;
          }

          .winner-color {
            width: 0.625rem;
            height: 0.625rem;
          }

          .winner-position {
            width: 1.75rem;
            height: 1.75rem;
            font-size: 0.75rem;
          }

          .participants-list,
          .winners-list {
            max-height: 12rem;
          }

          .remove-btn {
            opacity: 1;
          }

          .participant-name {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
