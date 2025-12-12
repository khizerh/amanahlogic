import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  describe("Rendering", () => {
    it("should render an input element", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("should render with placeholder", () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
    });

    it("should render with default value", () => {
      render(<Input defaultValue="default text" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("default text");
    });

    it("should render with controlled value", () => {
      render(<Input value="controlled value" onChange={() => {}} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("controlled value");
    });

    it("should apply custom className", () => {
      render(<Input className="custom-input" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("custom-input");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    });
  });

  describe("Input Types", () => {
    it("should render text input by default", () => {
      render(<Input />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      // When type is not specified, it defaults to 'text' in the DOM
      expect(input.type).toBe("text");
    });

    it("should render email input", () => {
      render(<Input type="email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });

    it("should render password input", () => {
      render(<Input type="password" data-testid="password-input" />);
      const input = screen.getByTestId("password-input");
      expect(input).toHaveAttribute("type", "password");
    });

    it("should render number input", () => {
      render(<Input type="number" />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("type", "number");
    });

    it("should render search input", () => {
      render(<Input type="search" />);
      const input = screen.getByRole("searchbox");
      expect(input).toHaveAttribute("type", "search");
    });

    it("should render tel input", () => {
      render(<Input type="tel" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "tel");
    });

    it("should render url input", () => {
      render(<Input type="url" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "url");
    });

    it("should render date input", () => {
      render(<Input type="date" data-testid="date-input" />);
      const input = screen.getByTestId("date-input");
      expect(input).toHaveAttribute("type", "date");
    });

    it("should render time input", () => {
      render(<Input type="time" data-testid="time-input" />);
      const input = screen.getByTestId("time-input");
      expect(input).toHaveAttribute("type", "time");
    });

    it("should render file input", () => {
      render(<Input type="file" data-testid="file-input" />);
      const input = screen.getByTestId("file-input");
      expect(input).toHaveAttribute("type", "file");
    });
  });

  describe("User Interactions", () => {
    it("should handle text input", async () => {
      const user = userEvent.setup();
      render(<Input />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.type(input, "Hello World");
      expect(input.value).toBe("Hello World");
    });

    it("should handle onChange events", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole("textbox");

      await user.type(input, "test");
      expect(handleChange).toHaveBeenCalledTimes(4); // Once per character
    });

    it("should handle controlled component updates", async () => {
      const user = userEvent.setup();
      const TestComponent = () => {
        const [value, setValue] = React.useState("");
        return <Input value={value} onChange={(e) => setValue(e.target.value)} />;
      };

      render(<TestComponent />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.type(input, "controlled");
      expect(input.value).toBe("controlled");
    });

    it("should handle clearing input", async () => {
      const user = userEvent.setup();
      render(<Input defaultValue="initial" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.clear(input);
      expect(input.value).toBe("");
    });

    it("should handle focus events", async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);
      const input = screen.getByRole("textbox");

      await user.click(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it("should handle blur events", async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);
      const input = screen.getByRole("textbox");

      await user.click(input);
      await user.tab();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it("should handle paste events", async () => {
      const user = userEvent.setup();
      const handlePaste = vi.fn();
      render(<Input onPaste={handlePaste} />);
      const input = screen.getByRole("textbox");

      input.focus();
      await user.paste("pasted text");
      expect(handlePaste).toHaveBeenCalled();
    });
  });

  describe("States", () => {
    it("should render disabled state", () => {
      render(<Input disabled />);
      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
      expect(input).toHaveClass("disabled:cursor-not-allowed");
      expect(input).toHaveClass("disabled:opacity-50");
    });

    it("should not accept input when disabled", async () => {
      const user = userEvent.setup();
      render(<Input disabled defaultValue="initial" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.type(input, "new text");
      expect(input.value).toBe("initial");
    });

    it("should render readonly state", async () => {
      const user = userEvent.setup();
      render(<Input readOnly defaultValue="readonly" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.type(input, "new text");
      expect(input.value).toBe("readonly");
    });

    it("should support required attribute", () => {
      render(<Input required />);
      const input = screen.getByRole("textbox");
      expect(input).toBeRequired();
    });

    it("should support autofocus", () => {
      render(<Input autoFocus />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveFocus();
    });
  });

  describe("Validation", () => {
    it("should support pattern attribute", () => {
      render(<Input type="tel" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("pattern", "[0-9]{3}-[0-9]{3}-[0-9]{4}");
    });

    it("should support min and max for number input", () => {
      render(<Input type="number" min="0" max="100" />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("min", "0");
      expect(input).toHaveAttribute("max", "100");
    });

    it("should support minLength and maxLength", () => {
      render(<Input minLength={5} maxLength={10} />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("minLength", "5");
      expect(input).toHaveAttribute("maxLength", "10");
    });

    it("should support step for number input", () => {
      render(<Input type="number" step="0.01" />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("step", "0.01");
    });
  });

  describe("Accessibility", () => {
    it("should support aria-label", () => {
      render(<Input aria-label="Username" />);
      expect(screen.getByLabelText("Username")).toBeInTheDocument();
    });

    it("should support aria-describedby", () => {
      render(
        <>
          <Input aria-describedby="input-description" />
          <div id="input-description">Enter your email address</div>
        </>
      );
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-describedby", "input-description");
    });

    it("should support aria-invalid", () => {
      render(<Input aria-invalid="true" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("should support aria-required", () => {
      render(<Input aria-required="true" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-required", "true");
    });

    it("should work with label element", () => {
      render(
        <div>
          <label htmlFor="test-input">Email</label>
          <Input id="test-input" type="email" />
        </div>
      );
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });
  });

  describe("Style Classes", () => {
    it("should have base styling classes", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("w-full");
      expect(input).toHaveClass("rounded-md");
      expect(input).toHaveClass("border");
      expect(input).toHaveClass("border-input");
      expect(input).toHaveClass("bg-transparent");
      expect(input).toHaveClass("px-3");
      expect(input).toHaveClass("py-1");
    });

    it("should merge custom className with default classes", () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("custom-class");
      expect(input).toHaveClass("w-full");
      expect(input).toHaveClass("rounded-md");
    });

    it("should have focus styles", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("focus-visible:outline-none");
      expect(input).toHaveClass("focus-visible:ring-1");
      expect(input).toHaveClass("focus-visible:ring-ring");
    });

    it("should have placeholder styles", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("placeholder:text-muted-foreground");
    });
  });

  describe("HTML Attributes", () => {
    it("should support name attribute", () => {
      render(<Input name="username" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("name", "username");
    });

    it("should support id attribute", () => {
      render(<Input id="unique-input" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("id", "unique-input");
    });

    it("should support autocomplete attribute", () => {
      render(<Input autoComplete="email" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("autoComplete", "email");
    });

    it("should support data attributes", () => {
      render(<Input data-testid="test-input" data-custom="value" />);
      const input = screen.getByTestId("test-input");
      expect(input).toHaveAttribute("data-custom", "value");
    });

    it("should support form attribute", () => {
      render(<Input form="my-form" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("form", "my-form");
    });
  });

  describe("Edge Cases", () => {
    it("should handle number input with string value", async () => {
      const user = userEvent.setup();
      render(<Input type="number" />);
      const input = screen.getByRole("spinbutton") as HTMLInputElement;

      await user.type(input, "abc123");
      // Browsers typically filter out non-numeric characters for number inputs
      expect(input.value).toBe("123");
    });

    it("should handle multiple rapid changes", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole("textbox");

      await user.type(input, "rapid");
      expect(handleChange).toHaveBeenCalledTimes(5);
    });

    it("should preserve value on re-render", () => {
      const { rerender } = render(<Input defaultValue="initial" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("initial");

      rerender(<Input defaultValue="initial" placeholder="Updated" />);
      expect(input.value).toBe("initial");
    });

    it("should handle empty string value", () => {
      render(<Input value="" onChange={() => {}} />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("");
    });

    it("should handle very long text", async () => {
      const user = userEvent.setup();
      const longText = "a".repeat(1000);
      render(<Input />);
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.type(input, longText);
      expect(input.value).toBe(longText);
    });
  });

  describe("Number Input Specific", () => {
    it("should handle number input with arrow keys", async () => {
      const user = userEvent.setup();
      render(<Input type="number" defaultValue="5" />);
      const input = screen.getByRole("spinbutton") as HTMLInputElement;

      input.focus();
      // Note: Arrow key increment/decrement behavior is browser-specific
      // and may not work consistently in jsdom. We're testing that the
      // input accepts the keyboard interaction without errors.
      await user.keyboard("{ArrowUp}");
      expect(input).toHaveFocus();

      await user.keyboard("{ArrowDown}");
      expect(input).toHaveFocus();
    });

    it("should accept numeric input via keyboard", async () => {
      const user = userEvent.setup();
      render(<Input type="number" />);
      const input = screen.getByRole("spinbutton") as HTMLInputElement;

      await user.type(input, "42");
      expect(input.value).toBe("42");
    });
  });

  describe("Form Integration", () => {
    it("should submit with form", async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn((e) => e.preventDefault());

      render(
        <form onSubmit={handleSubmit}>
          <Input name="test-input" />
          <button type="submit">Submit</button>
        </form>
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "test value");
      await user.click(screen.getByRole("button"));

      expect(handleSubmit).toHaveBeenCalled();
    });
  });
});

// Need to import React for the test component
import * as React from "react";
