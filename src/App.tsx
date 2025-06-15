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
import Lottie from "lottie-react";
import confettiAnimation from "./assets/confeti/confeti.json";
import AudioRuleta from "./assets/mp3/ruleta1.mp3";
import AudioFelicitacion from "./assets/mp3/congratulations.mp3";

interface Participant {
  id: string;
  name: string;
  color: string;
}

function App() {
  const SPIN_DURATION = 3000;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winnerBallAnimation, setWinnerBallAnimation] = useState(false);
  const tombolaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const congratulationsAudioRef = useRef<HTMLAudioElement>(null);

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
    setCurrentWinner(null);
    setWinnerBallAnimation(false);

    if (tombolaRef.current) {
      tombolaRef.current.style.transform = "rotate(1080deg)";
      tombolaRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

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
      {/* Lottie Confetti Animation - CORREGIDO */}
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
                      }}
                    >
                      <div className="position-absolute tombola-inner">
                        {participants.map((participant, index) => {
                          const position = ballPositions[index];
                          const isWinnerBall =
                            currentWinner &&
                            participant.id === currentWinner.id;

                          return (
                            <div
                              key={participant.id}
                              className={`participant-ball ${
                                isSpinning
                                  ? "animate-bounce"
                                  : isWinnerBall && winnerBallAnimation
                                  ? "animate-ping winner-glow"
                                  : "animate-pulse"
                              }`}
                              style={{
                                backgroundColor: participant.color,
                                left: `${position.x}%`,
                                top: `${position.y}%`,
                                transform: `translate(-50%, -50%) ${
                                  isWinnerBall && winnerBallAnimation
                                    ? "scale(1.5)"
                                    : "scale(1)"
                                }`,
                                zIndex:
                                  isWinnerBall && winnerBallAnimation ? 10 : 1,
                                boxShadow:
                                  isWinnerBall && winnerBallAnimation
                                    ? `0 0 25px ${participant.color}`
                                    : "0 5px 10px rgba(0,0,0,0.3)",
                              }}
                            >
                              <div className="participant-ball-content">
                                <span className="participant-initial">
                                  {participant.name.charAt(0).toUpperCase()}
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
