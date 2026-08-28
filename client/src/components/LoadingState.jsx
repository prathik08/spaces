import { useState, useEffect } from 'react';

const STEPS = [
  { text: 'Uploading room photo',          delay: 0     },
  { text: 'Analyzing spatial proportions', delay: 4000  },
  { text: 'Generating design suggestions', delay: 12000 },
  { text: 'Finding matching products',     delay: 24000 },
  { text: 'Almost ready',                  delay: 32000 },
];

export default function LoadingState() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((step, i) =>
      setTimeout(() => setActiveStep(i), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="loading">
      <div className="spinner" />
      <h3>Analyzing your space</h3>
      <p>This takes about 30–50 seconds</p>
      <div className="loading-steps">
        {STEPS.map((step, i) => (
          <div key={i} className={`loading-step ${i <= activeStep ? 'active' : ''}`}>
            {step.text}
          </div>
        ))}
      </div>
    </div>
  );
}
