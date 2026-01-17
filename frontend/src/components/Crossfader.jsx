export default function Crossfader({ value, onChange }) {
  return (
    <div className="w-[90%] mx-auto flex flex-col items-center gap-2 py-2">
      <div className="flex items-center gap-3 w-full">
        <div className="text-purple-400 text-xs font-medium flex-shrink-0">P1</div>

        <div className="relative flex-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-2 bg-gradient-to-r from-purple-600 via-purple-400 to-pink-600 rounded-full opacity-30" />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="relative w-full h-2 appearance-none bg-transparent cursor-pointer
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

        <div className="text-pink-400 text-xs font-medium flex-shrink-0">P2</div>
      </div>
    </div>
  );
}
