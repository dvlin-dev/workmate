import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { TrustStrip } from './sections/TrustStrip';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { DemoShowcase } from './sections/DemoShowcase';
import { Features } from './sections/Features';
import { Compare } from './sections/Compare';
import { DownloadCTA } from './sections/DownloadCTA';
import { Footer } from './sections/Footer';

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <DemoShowcase />
        <Problem />
        <HowItWorks />
        <Features />
        <Compare />
        <DownloadCTA />
      </main>
      <Footer />
    </div>
  );
}
