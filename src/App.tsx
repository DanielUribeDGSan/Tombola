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
      }, 5000); // Aumentamos a 5 segundos para que Lottie se vea completo
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
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-purple-600 p-4">
      {/* Lottie Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <Lottie
            animationData={confettiAnimation}
            style={{ width: "100%", height: "100%" }}
            loop={false}
            autoplay={true}
          />
        </div>
      )}

      <div className="container-fluid">
        {/* Header */}
        <div className="row">
          <div className="col-12">
            <div className="text-center mb-4 mb-md-5 header-section">
              <h1 className="tombola-title">🎊 TOMBOLA MÁGICA 🎊</h1>
              <p className="tombola-subtitle">
                ¡Agrega participantes y gira la tombola para elegir un ganador!
              </p>
              <p className="tombola-timer">
                ⏱️ Tiempo de giro: {SPIN_DURATION / 1000} segundos
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="row g-3 g-lg-4">
          {/* Tombola Column */}
          <div className="col-12 col-lg-6 order-2 order-lg-1">
            <div className="tombola-card">
              <div className="tombola-wrapper">
                <div
                  ref={tombolaRef}
                  className={`tombola-roulette ${isSpinning ? "spinning" : ""}`}
                >
                  <div className="tombola-inner">
                    {participants.map((participant, index) => {
                      const position = ballPositions[index];
                      const isWinnerBall =
                        currentWinner && participant.id === currentWinner.id;

                      return (
                        <div
                          key={participant.id}
                          className={`participant-ball ${
                            isSpinning
                              ? "bouncing"
                              : isWinnerBall && winnerBallAnimation
                              ? "winner-ball"
                              : "floating"
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
                          <div className="participant-ball-inner">
                            <span className="participant-initial">
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="tombola-center">
                    <Sparkles
                      className={`tombola-center-icon ${
                        isSpinning ? "spinning-icon" : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Winner Display */}
              {currentWinner && (
                <div className="winner-display">
                  <div className="winner-icons">
                    <Trophy className="winner-trophy" />
                    <div className="winner-emoji">🎉</div>
                    <Trophy className="winner-trophy" />
                  </div>
                  <h3 className="winner-title">¡FELICITACIONES!</h3>
                  <p className="winner-name">{currentWinner.name}</p>
                  <div className="winner-subtitle">
                    <span>¡Eres el ganador!</span>
                    <div
                      className="winner-color-indicator"
                      style={{ backgroundColor: currentWinner.color }}
                    />
                  </div>
                  <div className="winner-stars">🌟 ¡Increíble suerte! 🌟</div>
                </div>
              )}

              {/* Spin Button */}
              <button
                onClick={spinTombola}
                disabled={participants.length < 2 || isSpinning}
                className={`btn w-100 spin-button ${
                  participants.length >= 2 && !isSpinning
                    ? "btn-primary spin-button-active"
                    : "btn-secondary spin-button-disabled"
                }`}
              >
                <div className="d-flex align-items-center justify-content-center gap-2">
                  <Play
                    className={`spin-button-icon ${
                      isSpinning ? "spinning-icon" : ""
                    }`}
                  />
                  <span className="spin-button-text">
                    {isSpinning ? "¡Girando la Magia!" : "¡GIRAR TOMBOLA!"}
                  </span>
                </div>
              </button>

              {participants.length < 2 && (
                <p className="text-center text-muted mt-2 small">
                  Necesitas al menos 2 participantes
                </p>
              )}

              <p className="text-center text-muted mt-2 small">
                Presiona ESPACIO para girar rápidamente
              </p>

              <button
                onClick={resetGame}
                disabled={isSpinning}
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2 mx-auto mt-3 reset-button"
              >
                <RotateCcw className="reset-icon" />
                Reiniciar Todo
              </button>
            </div>
          </div>

          {/* Participants and Winners Column */}
          <div className="col-12 col-lg-6 order-1 order-lg-2">
            {/* Participants Panel */}
            <div className="side-panel participants-panel mb-3 mb-lg-4">
              <div className="side-panel-header">
                <Users className="side-panel-icon text-primary" />
                <h2 className="side-panel-title">Participantes</h2>
                <span className="badge bg-primary rounded-pill">
                  {participants.length}
                </span>
              </div>

              <div className="participants-input mb-3">
                <div className="input-group">
                  <input
                    type="text"
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nombre del participante"
                    className="form-control participant-input"
                    disabled={isSpinning}
                  />
                  <button
                    onClick={addParticipant}
                    disabled={!newParticipant.trim() || isSpinning}
                    className="btn btn-success add-participant-btn"
                    type="button"
                  >
                    <Plus className="add-icon" />
                  </button>
                </div>
              </div>

              <div className="participants-list">
                {participants.map((participant) => (
                  <div key={participant.id} className="participant-item">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="participant-color"
                        style={{ backgroundColor: participant.color }}
                      />
                      <span className="participant-name">
                        {participant.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      disabled={isSpinning}
                      className="btn btn-sm btn-outline-danger remove-btn"
                    >
                      <Trash2 className="remove-icon" />
                    </button>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="empty-state">
                    <Users className="empty-icon" />
                    <p className="empty-title">No hay participantes aún</p>
                    <p className="empty-subtitle">
                      Agrega al menos 2 para comenzar
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Winners Panel */}
            <div className="side-panel winners-panel">
              <div className="side-panel-header">
                <Trophy className="side-panel-icon text-warning" />
                <h2 className="side-panel-title">Ganadores</h2>
                <span className="badge bg-warning rounded-pill">
                  {winners.length}
                </span>
              </div>

              <div className="winners-list">
                {winners.map((winner, index) => (
                  <div key={`${winner.id}-${index}`} className="winner-item">
                    <div className="winner-position">
                      {winners.length - index}
                    </div>
                    <div className="winner-info">
                      <p className="winner-item-name">{winner.name}</p>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <div
                          className="winner-item-color"
                          style={{ backgroundColor: winner.color }}
                        />
                        <span className="winner-round">
                          Ronda {winners.length - index}
                        </span>
                      </div>
                    </div>
                    <Trophy className="winner-item-trophy" />
                  </div>
                ))}
                {winners.length === 0 && (
                  <div className="empty-state">
                    <Trophy className="empty-icon" />
                    <p className="empty-title">Aún no hay ganadores</p>
                    <p className="empty-subtitle">
                      ¡Gira la tombola para comenzar!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Tip */}
        <div className="row mt-4 mt-lg-5">
          <div className="col-12">
            <div className="text-center footer-tip">
              <p>
                💡 <strong>Consejo:</strong> Puedes usar la barra espaciadora
                para girar rápidamente
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) translateX(0) rotate(0deg);
            opacity: 1;
          }
          10% {
            transform: translateY(-90vh) translateX(10px) rotate(90deg);
          }
          20% {
            transform: translateY(-70vh) translateX(-5px) rotate(180deg);
          }
          30% {
            transform: translateY(-50vh) translateX(15px) rotate(270deg);
          }
          40% {
            transform: translateY(-30vh) translateX(-10px) rotate(360deg);
          }
          50% {
            transform: translateY(-10vh) translateX(20px) rotate(450deg);
          }
          60% {
            transform: translateY(10vh) translateX(-15px) rotate(540deg);
          }
          70% {
            transform: translateY(30vh) translateX(10px) rotate(630deg);
          }
          80% {
            transform: translateY(50vh) translateX(-5px) rotate(720deg);
          }
          90% {
            transform: translateY(70vh) translateX(15px) rotate(810deg);
          }
          100% {
            transform: translateY(100vh) translateX(0) rotate(900deg);
            opacity: 0;
          }
        }

        @keyframes confetti-burst {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(0.1);
            opacity: 1;
          }
          20% {
            transform: translate(-50%, -50%) rotate(var(--burst-angle))
              translateX(calc(var(--burst-distance) * 0.3))
              rotate(var(--burst-rotation)) scale(1.3);
            opacity: 1;
          }
          60% {
            transform: translate(-50%, -50%) rotate(var(--burst-angle))
              translateX(var(--burst-distance))
              rotate(calc(var(--burst-rotation) * 2)) scale(1);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--burst-angle))
              translateX(calc(var(--burst-distance) * 1.5))
              rotate(calc(var(--burst-rotation) * 3)) scale(0.3);
            opacity: 0;
          }
        }

        @keyframes confetti-gravity {
          0% {
            transform: translate(-50%, -50%) scale(0.1) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translate(-50%, -50%)
              translateX(calc(var(--gravity-x) * 0.5)) translateY(-100px)
              scale(1.2) rotate(180deg);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) translateX(var(--gravity-x))
              translateY(-50px) scale(1) rotate(360deg);
            opacity: 0.9;
          }
          75% {
            transform: translate(-50%, -50%)
              translateX(calc(var(--gravity-x) * 1.2)) translateY(50px)
              scale(0.8) rotate(540deg);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%)
              translateX(calc(var(--gravity-x) * 1.5)) translateY(200px)
              scale(0.3) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes confetti-explode {
          0% {
            transform: translate(-50%, -50%) rotate(var(--explosion-angle))
              translateX(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) rotate(var(--explosion-angle))
              translateX(200px) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--explosion-angle))
              translateX(400px) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes bounce-in {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }

        .animate-confetti-burst {
          animation: confetti-burst ease-out forwards;
        }

        .animate-confetti-gravity {
          animation: confetti-gravity cubic-bezier(0.25, 0.46, 0.45, 0.94)
            forwards;
        }

        .animate-confetti-explode {
          animation: confetti-explode ease-out forwards;
        }

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
      `}</style>

      {/* Audio element para el sonido de la ruleta */}
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
