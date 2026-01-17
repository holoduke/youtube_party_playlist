export default function Crossfader({ value, onChange }) {
  const player1Volume = 100 - value;
  const player2Volume = value;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-purple-400 text-xs font-medium mb-1">Player 1</div>
          <div className="text-white text-lg font-bold">{player1Volume}%</div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-2 bg-gradient-to-r from-purple-600 via-purple-400 to-pink-600 rounded-full opacity-30" />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="relative w-48 h-2 appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full
              [&::-webkit-slider-runnable-track]:bg-gradient-to-r [&::-webkit-slider-runnable-track]:from-purple-600
              [&::-webkit-slider-runnable-track]:via-purple-400 [&::-webkit-slider-runnable-track]:to-pink-600
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/50
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-400
              [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
          />
        </div>

        <div className="text-center">
          <div className="text-pink-400 text-xs font-medium mb-1">Player 2</div>
          <div className="text-white text-lg font-bold">{player2Volume}%</div>
        </div>
      </div>

      <div className="text-xs text-purple-300/60">Crossfader</div>
    </div>
  );
}
