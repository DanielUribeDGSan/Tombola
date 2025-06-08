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

// Cambiar la importación al nuevo archivo de audio
import Ruleta1Mp3 from "./assets/mp3/ruleta1.mp3";

interface Participant {
  id: string;
  name: string;
  color: string;
}

function App() {
  // 🎛️ VARIABLE CONFIGURABLE PARA EL TIEMPO DE GIRO (en milisegundos)
  const SPIN_DURATION = 10000; // Cambia este valor para modificar el tiempo de giro

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winnerBallAnimation, setWinnerBallAnimation] = useState(false);
  const tombolaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  // Memorizar posiciones de las bolas para evitar recálculos
  const ballPositions = useMemo(() => {
    return participants.map((_, index) => {
      const angle = (index * 137.5) % 360;
      const radius = 15 + (index % 3) * 8;
      const centerX = 50;
      const centerY = 50;

      const x = centerX + Math.cos((angle * Math.PI) / 180) * radius;
      const y = centerY + Math.sin((angle * Math.PI) / 180) * radius;

      const maxRadius = 35;
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

    // Reproducir sonido con loop
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reiniciar audio si ya está reproduciéndose
      audioRef.current.play().catch((error) => {
        console.log("No se pudo reproducir el audio:", error);
      });
    }

    setIsSpinning(true);
    setCurrentWinner(null);
    setWinnerBallAnimation(false);

    // Usar la variable configurable para la duración
    const duration = SPIN_DURATION;

    // Animación de la tombola usando la duración configurable
    if (tombolaRef.current) {
      tombolaRef.current.style.transform = "rotate(1080deg)";
      tombolaRef.current.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    setTimeout(() => {
      // Detener el sonido cuando termine el giro
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

      if (tombolaRef.current) {
        tombolaRef.current.style.transform = "rotate(0deg)";
        tombolaRef.current.style.transition = "";
      }

      // Reducir tiempo de confetti
      setTimeout(() => {
        setShowConfetti(false);
        setWinnerBallAnimation(false);
      }, 2000);
    }, duration); // Usar la duración configurable aquí también
  }, [participants, isSpinning, SPIN_DURATION]);

  const resetGame = useCallback(() => {
    if (!isSpinning) {
      // Detener cualquier sonido que esté reproduciéndose
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
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

  // Cleanup audio al desmontar el componente
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Confetti optimizado - menos partículas
  const confettiElements = useMemo(() => {
    if (!showConfetti) return null;

    return [...Array(30)].map((_, i) => (
      <div
        key={i}
        className="fixed animate-confetti-fall pointer-events-none"
        style={{
          left: `${Math.random() * 100}%`,
          top: "-20px",
          fontSize: `${12 + Math.random() * 16}px`,
          color: colors[Math.floor(Math.random() * colors.length)],
          animationDelay: `${Math.random() * 1}s`,
          zIndex: 50,
        }}
      >
        {Math.random() > 0.5 ? "✨" : "🎉"}
      </div>
    ));
  }, [showConfetti, colors]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-purple-600 p-4">
      {confettiElements}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            🎊 TOMBOLA MÁGICA 🎊
          </h1>
          <p className="text-xl text-white/90 font-medium">
            ¡Agrega participantes y gira la tombola para elegir un ganador!
          </p>
          {/* Indicador del tiempo de giro configurado */}
          <p className="text-sm text-white/70 mt-2">
            ⏱️ Tiempo de giro: {SPIN_DURATION / 1000} segundos
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Participants */}
          <div className="lg:col-span-1">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-800">
                  Participantes
                </h2>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                  {participants.length}
                </span>
              </div>

              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nombre del participante"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    disabled={isSpinning}
                  />
                  <button
                    onClick={addParticipant}
                    disabled={!newParticipant.trim() || isSpinning}
                    className="px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl transition-colors duration-200 flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: participant.color }}
                      />
                      <span className="font-medium text-gray-800">
                        {participant.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      disabled={isSpinning}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 transition-all duration-200 disabled:opacity-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay participantes aún</p>
                    <p className="text-sm">Agrega al menos 2 para comenzar</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center Panel - Tombola */}
          <div className="lg:col-span-1">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl text-center">
              <div className="relative mb-8">
                <div
                  ref={tombolaRef}
                  className="w-48 h-48 mx-auto relative overflow-hidden transition-transform duration-500"
                  style={{
                    background: "linear-gradient(145deg, #e2e8f0, #cbd5e1)",
                    borderRadius: "50%",
                    border: "8px solid #64748b",
                    boxShadow:
                      "inset 0 4px 8px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.3)",
                  }}
                >
                  <div className="absolute inset-2 rounded-full">
                    {participants.map((participant, index) => {
                      const position = ballPositions[index];
                      const isWinnerBall =
                        currentWinner && participant.id === currentWinner.id;

                      return (
                        <div
                          key={participant.id}
                          className={`absolute w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-300 ${
                            isSpinning
                              ? "animate-bounce-crazy"
                              : isWinnerBall && winnerBallAnimation
                              ? "animate-winner-glow"
                              : "animate-float"
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
                                ? `0 0 15px ${participant.color}`
                                : "0 2px 4px rgba(0,0,0,0.2)",
                            animationDelay: `${index * 0.1}s`,
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="absolute inset-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg flex items-center justify-center z-20">
                    <Sparkles
                      className={`w-6 h-6 text-white ${
                        isSpinning ? "animate-spin" : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="flex gap-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-6 h-6 text-yellow-400 fill-current"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {currentWinner && (
                <div className="mb-6 p-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-2xl text-white animate-bounce-in">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Trophy className="w-12 h-12" />
                    <div className="text-4xl">🎉</div>
                    <Trophy className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">¡FELICITACIONES!</h3>
                  <p className="text-3xl font-bold mb-2">
                    {currentWinner.name}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-lg">
                    <span>¡Eres el ganador!</span>
                    <div
                      className="w-4 h-4 rounded-full border-2 border-white"
                      style={{ backgroundColor: currentWinner.color }}
                    />
                  </div>
                  <div className="mt-3 text-sm opacity-90">
                    🌟 ¡Increíble suerte! 🌟
                  </div>
                </div>
              )}

              <button
                onClick={spinTombola}
                disabled={participants.length < 2 || isSpinning}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-xl transition-all duration-300 ${
                  participants.length >= 2 && !isSpinning
                    ? "bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white transform hover:scale-105 shadow-lg"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <Play
                    className={`w-6 h-6 ${isSpinning ? "animate-spin" : ""}`}
                  />
                  {isSpinning ? "¡Girando la Magia!" : "¡GIRAR TOMBOLA!"}
                </div>
              </button>

              {participants.length < 2 && (
                <p className="text-sm text-gray-500 mt-2">
                  Necesitas al menos 2 participantes
                </p>
              )}

              <p className="text-xs text-gray-400 mt-2">
                Presiona ESPACIO para girar rápidamente
              </p>

              <button
                onClick={resetGame}
                disabled={isSpinning}
                className="mt-4 px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar Todo
              </button>
            </div>
          </div>

          {/* Right Panel - Winners */}
          <div className="lg:col-span-1">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Trophy className="w-6 h-6 text-yellow-600" />
                <h2 className="text-2xl font-bold text-gray-800">Ganadores</h2>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm font-medium">
                  {winners.length}
                </span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {winners.map((winner, index) => (
                  <div
                    key={`${winner.id}-${index}`}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {winners.length - index}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{winner.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="w-3 h-3 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: winner.color }}
                        />
                        <span className="text-xs text-gray-500">
                          Ronda {winners.length - index}
                        </span>
                      </div>
                    </div>
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  </div>
                ))}
                {winners.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aún no hay ganadores</p>
                    <p className="text-sm">¡Gira la tombola para comenzar!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-white/80">
          <p className="text-sm">
            💡 <strong>Consejo:</strong> Puedes usar la barra espaciadora para
            girar rápidamente
          </p>
        </div>
      </div>

      {/* Audio element para el sonido ruleta1 */}
      <audio ref={audioRef} preload="auto" style={{ display: "none" }} loop>
        <source src={Ruleta1Mp3} type="audio/mpeg" />
        <source src="/assets/ruleta1.wav" type="audio/wav" />
        Tu navegador no soporta audio.
      </audio>

      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
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

        @keyframes winner-glow {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1.5);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.7);
          }
        }

        @keyframes bounce-crazy {
          0%,
          20%,
          50%,
          80%,
          100% {
            transform: translate(-50%, -50%) translateY(0) translateX(0)
              scale(1);
          }
          10% {
            transform: translate(-50%, -50%) translateY(-8px) translateX(4px)
              scale(1.05);
          }
          30% {
            transform: translate(-50%, -50%) translateY(-12px) translateX(-6px)
              scale(0.95);
          }
          60% {
            transform: translate(-50%, -50%) translateY(-6px) translateX(8px)
              scale(1.02);
          }
          90% {
            transform: translate(-50%, -50%) translateY(-10px) translateX(-4px)
              scale(0.98);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(-50%, -50%) translateY(0px) rotate(0deg);
          }
          33% {
            transform: translate(-50%, -50%) translateY(-2px) rotate(1deg);
          }
          66% {
            transform: translate(-50%, -50%) translateY(-1px) rotate(-0.5deg);
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall 2s linear forwards;
        }

        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .animate-bounce-crazy {
          animation: bounce-crazy 0.6s ease-in-out infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-winner-glow {
          animation: winner-glow 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default App;
