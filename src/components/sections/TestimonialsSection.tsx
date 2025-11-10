import { Quote } from "lucide-react";

const testimonials = [
  {
    text: "Grâce à Advisy, j'ai enfin compris comment optimiser mes assurances sans payer plus que nécessaire.",
    name: "Sophie M.",
    subtitle: "Indépendante, Genève",
  },
  {
    text: "Un accompagnement clair, réactif et vraiment centré sur mes besoins. Je recommande.",
    name: "Hugo L.",
    subtitle: "Employé, Lausanne",
  },
  {
    text: "J'ai pu mettre en place une stratégie de prévoyance cohérente pour ma famille et mon activité.",
    name: "Karim A.",
    subtitle: "Entrepreneur, Valais",
  },
];

export const TestimonialsSection = () => {
  return (
    <section id="temoignages" className="py-20 lg:py-32 bg-gradient-subtle">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Ils nous ont fait confiance
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-8 shadow-medium hover:shadow-strong transition-all duration-300 hover:-translate-y-2 border border-border animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Quote Icon */}
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Quote className="w-6 h-6 text-primary" />
              </div>

              {/* Testimonial Text */}
              <p className="text-foreground leading-relaxed mb-6 italic">
                "{testimonial.text}"
              </p>

              {/* Author Info */}
              <div className="border-t border-border pt-4">
                <p className="font-semibold text-foreground">
                  {testimonial.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {testimonial.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
