import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Vos conseils sont-ils vraiment indépendants ?",
    answer:
      "Oui. Notre rôle est de vous présenter des solutions adaptées à votre situation, en toute transparence, en expliquant toujours les avantages et les limites de chaque option.",
  },
  {
    question: "Combien coûtent vos services ?",
    answer:
      "Nous vous expliquons toujours clairement la façon dont nous sommes rémunérés avant toute collaboration. Pas de frais cachés, pas de surprise.",
  },
  {
    question: "Travaillez-vous uniquement en Suisse romande ?",
    answer:
      "Nous sommes basés en Suisse romande, mais nous pouvons aussi accompagner des clients dans d'autres régions de Suisse en visio.",
  },
  {
    question: "Est-ce que le premier entretien est payant ?",
    answer:
      "Le premier échange sert à comprendre votre situation et vos besoins. Nous vous expliquons ensuite clairement la suite de l'accompagnement.",
  },
  {
    question: "Avec quels types de profils travaillez-vous ?",
    answer:
      "Nous accompagnons des particuliers, des familles, des indépendants et des petites entreprises.",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Questions fréquentes
          </h2>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto animate-slide-up">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border shadow-soft px-6 hover:shadow-medium transition-shadow"
              >
                <AccordionTrigger className="text-left text-foreground font-semibold hover:text-primary py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
