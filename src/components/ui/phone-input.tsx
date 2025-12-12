import * as React from "react";
import { Input } from "./input";
import {
  formatPhoneNumber,
  formatPhoneAsYouType,
  getMaxPhoneDigits,
  SUPPORTED_COUNTRIES,
  type SupportedCountry,
} from "@imarah/shared-utils";
import { cn } from "../../lib/utils";

export interface PhoneInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  /** Organization country for international phone formatting and hints */
  orgCountry?: SupportedCountry;
  /** Error message to display */
  error?: string;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, orgCountry, error, className, ...props }, ref) => {
    const [warning, setWarning] = React.useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      setWarning(null);

      if (orgCountry) {
        // Country-aware mode: format as-you-type and limit digits
        const digits = input.replace(/\D/g, "");
        const maxDigits = getMaxPhoneDigits(orgCountry);

        // Limit to max digits for the country
        if (digits.length > maxDigits) {
          return; // Don't allow more digits
        }

        // Format the input as user types
        const formatted = formatPhoneAsYouType(input, orgCountry);

        // Show warnings for mismatched country formats
        if (input.startsWith("+44") && orgCountry !== "GB") {
          setWarning("This looks like a UK number.");
        } else if (input.startsWith("+1") && orgCountry === "GB") {
          setWarning("This looks like a US/CA number.");
        } else if (input.startsWith("0") && digits.length >= 10 && orgCountry === "US") {
          setWarning("Numbers starting with 0 are typically UK format.");
        }

        onChange(formatted);
      } else {
        // Legacy US-only mode
        const formatted = formatPhoneNumber(input);
        onChange(formatted);
      }
    };

    const placeholder = orgCountry
      ? SUPPORTED_COUNTRIES[orgCountry]?.phoneExample || "(555) 123-4567"
      : "(555) 123-4567";

    if (orgCountry) {
      // Country-aware mode with formatting and warnings
      return (
        <div className="space-y-1">
          <Input
            ref={ref}
            type="tel"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={cn(error && "border-red-500", className)}
            {...props}
          />
          {warning && <p className="text-amber-600 text-sm">{warning}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      );
    }

    // Legacy simple mode
    return (
      <Input
        ref={ref}
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
