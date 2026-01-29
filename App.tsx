import React, { useState, useEffect } from 'react';
import Game from './components/Game';

const App: React.FC = () => {
  // Set theme to dark by default as requested
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Basic SEO updates via document properties
    document.title = "הקוביה - משחק פעולה לגו מטורף";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "הקוביה: משחק פעולה של פירוק לגו. הילחמו ביצורי לגו בעזרת רובי קוביות, פצצות ולייזרים.");
    }
  }, [darkMode]);

  const startGame = () => {
    setGameState('PLAYING');
    setScore(0);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setGameState('GAMEOVER');
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center overflow-hidden transition-colors duration-300">
      
      {/* Theme Toggle Button */}
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-4 right-4 z-50 p-3 bg-white dark:bg-slate-800 rounded-full shadow-lg border-2 border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
        aria-label="Toggle Theme"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      {/* AdSense Placeholder - Top Ad Unit */}
      <div className="absolute top-0 w-full h-16 flex items-center justify-center opacity-10 pointer-events-none z-0">
        <div className="bg-slate-400 w-full max-w-4xl h-full flex items-center justify-center text-[10px]">AD UNIT</div>
      </div>

      {gameState === 'START' && (
        <div className="z-10 p-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-3xl shadow-2xl text-center max-w-lg border-8 border-yellow-400 mx-4">
          <h1 className="text-6xl font-black mb-6 text-red-600 dark:text-red-500 drop-shadow-md">הקוביה</h1>
          <p className="text-xl mb-8 text-slate-700 dark:text-slate-300 leading-relaxed font-bold">
            יצורי לגו פלשו לעולם הקוביות! שרוד 30 שניות בכל שלב ושדרג את הנשקים שלך.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8 text-right text-sm">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg dark:text-blue-200"><strong>חיצים:</strong> תנועה וקפיצה</div>
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg dark:text-red-200"><strong>1-7:</strong> החלפת נשק</div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg dark:text-green-200"><strong>רווח:</strong> ירי</div>
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg dark:text-yellow-100"><strong>עכבר:</strong> כיוון (אופציונלי)</div>
          </div>
          <button 
            onClick={startGame}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white text-3xl font-black rounded-xl transition-all transform hover:scale-105 shadow-xl border-b-8 border-red-800 active:border-b-0 active:translate-y-2"
          >
            התחל משחק
          </button>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="w-full h-full">
          <Game onGameOver={handleGameOver} />
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div className="z-10 p-12 bg-white/95 dark:bg-slate-800/95 rounded-3xl shadow-2xl text-center max-w-md border-8 border-red-500 animate-in fade-in zoom-in duration-300 mx-4">
          <h2 className="text-5xl font-black mb-2 text-red-600">הפסדת!</h2>
          <p className="text-3xl font-bold mb-6 text-slate-700 dark:text-slate-300">ניקוד סופי: {score}</p>
          
          <button 
            onClick={startGame}
            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white text-2xl font-black rounded-xl transition-all shadow-lg border-b-8 border-green-800 active:border-b-0 active:translate-y-2"
          >
            נסה שוב
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium z-10 pointer-events-none">
        <p dir="ltr" className="px-4">(C) Noam Gold AI 2026 | Send Feedback: <a href="mailto:goldnoamai@gmail.com" className="pointer-events-auto hover:text-red-500 transition-colors">goldnoamai@gmail.com</a></p>
      </footer>

      {/* Background Decor */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-400 rounded-full opacity-10 blur-xl"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-red-500 rounded-full opacity-10 blur-2xl"></div>
    </div>
  );
};

export default App;