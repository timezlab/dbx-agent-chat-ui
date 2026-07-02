"use client";

import * as React from "react";
import { BracesIcon, PaintbrushIcon, PaletteIcon } from "lucide-react";
import { DocCard, DocsSection, SectionLead } from "../components";

export function CustomizationSection() {
  return (
    <DocsSection
      id="customization"
      icon={<PaintbrushIcon className="size-4" />}
      title="Customization & Theming"
    >
      <SectionLead>
        The UI is built to be re-skinned by consumers without forking.
        Customization is supported via three primary pillars:
      </SectionLead>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DocCard
          icon={<PaletteIcon className="size-4" />}
          title="CSS Variables"
          desc="All visual tokens (colors, radius, typography) map to CSS variables in globals.css."
        />
        <DocCard
          icon={<BracesIcon className="size-4" />}
          title="Class Overrides"
          desc="Every component forwards className and merges it via cn(), allowing external styling overrides."
        />
      </div>
    </DocsSection>
  );
}
