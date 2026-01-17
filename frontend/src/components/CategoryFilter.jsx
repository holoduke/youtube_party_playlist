export default function CategoryFilter({ categories, selectedCategory, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
          selectedCategory === null
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
            : 'bg-white/10 text-purple-200 hover:bg-white/20 backdrop-blur-sm'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
            selectedCategory === category.id
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
              : 'bg-white/10 text-purple-200 hover:bg-white/20 backdrop-blur-sm'
          }`}
        >
          {category.name}
          <span className="ml-1 text-xs opacity-70">({category.videos_count})</span>
        </button>
      ))}
    </div>
  );
}
