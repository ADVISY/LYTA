import { Quote, Star } from "lucide-react";
import advisorWoman from "@/assets/advisor-woman.jpg";
import clientHappy from "@/assets/client-happy.jpg";
import businessman from "@/assets/businessman.jpg";

const testimonials = [
  {
    text: "Grâce à Advisy, j'ai enfin compris comment optimiser mes assurances sans payer plus que nécessaire. Un service professionnel et vraiment personnalisé.",
    name: "Sophie Martinez",
    subtitle: "Indépendante, Genève",
    image: advisorWoman,
    rating: 5,
  },
  {
    text: "Un accompagnement clair, réactif et vraiment centré sur mes besoins. J'ai économisé plus de 2000 CHF par an sur mes assurances !",
    name: "Hugo Laurent",
    subtitle: "Employé, Lausanne",
    image: clientHappy,
    rating: 5,
  },
  {
    text: "J'ai pu mettre en place une stratégie de prévoyance cohérente pour ma famille et mon activité. Des conseils précieux et impartiaux.",
    name: "Karim Amrani",
    subtitle: "Entrepreneur, Valais",
    image: businessman,
    rating: 5,
  },
];

export const TestimonialsSection = () => {
  return (
    <section id="temoignages" className="relative py-20 lg:py-32 bg-gradient-subtle overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Témoignages clients
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Ils nous ont fait{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              confiance
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Découvrez l'expérience de nos clients satisfaits
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group bg-gradient-card backdrop-blur-sm rounded-3xl p-8 shadow-medium hover:shadow-glow transition-all duration-500 hover:-translate-y-3 border border-border animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Quote Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-6 shadow-medium group-hover:scale-110 transition-transform duration-300">
                <Quote className="w-6 h-6 text-white" />
              </div>

              {/* Rating Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 text-primary fill-primary"
                  />
                ))}
              </div>

              {/* Testimonial Text */}
              <p className="text-foreground leading-relaxed mb-6 text-base">
                "{testimonial.text}"
              </p>

              {/* Author Info with Photo */}
              <div className="flex items-center gap-4 border-t border-border pt-6">
                <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-300">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
