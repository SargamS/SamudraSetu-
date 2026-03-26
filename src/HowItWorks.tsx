export default function HowItWorks() {
  const features = [
    {
      title: "Report Hazards",
      icon: "🚨",
      desc: "Quickly report coastal dangers like floods, high tides, or accidents.",
    },
    {
      title: "Safe Locations",
      icon: "📍",
      desc: "Find safe locations across cities in India during emergencies.",
    },
    {
      title: "Add Media",
      icon: "📸",
      desc: "Upload images or videos of calamities.",
    },
    {
      title: "Analysis & Stats",
      icon: "📊",
      desc: "View insights and trends about hazards.",
    },
    {
      title: "Community",
      icon: "💬",
      desc: "Interact and share updates with others.",
    },
  ];

  return (
    <section className="bg-blue-900 text-white py-16 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl font-bold mb-6">
          🌊 How Samudrasetu Works
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((item, index) => (
            <div
              key={index}
              className="bg-white/10 p-6 rounded-xl hover:scale-105 transition"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="text-gray-300 text-sm mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
