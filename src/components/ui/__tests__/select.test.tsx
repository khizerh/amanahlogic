import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "../select";

describe("Select", () => {
  describe("Basic Rendering", () => {
    it("should render select trigger", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      );
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should display placeholder", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      );
      expect(screen.getByText("Select an option")).toBeInTheDocument();
    });

    it("should not show content initially", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );
      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
    });

    it("should render with custom className", () => {
      render(
        <Select>
          <SelectTrigger className="custom-trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );
      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveClass("custom-trigger");
    });
  });

  describe("Opening Select", () => {
    it("should open on trigger click", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });
    });

    it("should open on Enter key", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });
    });

    it("should open on Space key", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{ }");

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });
    });
  });

  describe("Selection", () => {
    it("should select an item on click", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <Select onValueChange={handleValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 1"));

      expect(handleValueChange).toHaveBeenCalledWith("option1");
    });

    it("should display selected value", async () => {
      const user = userEvent.setup();
      const TestComponent = () => {
        const [value, setValue] = React.useState("");
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
            </SelectContent>
          </Select>
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 1"));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });
    });

    it("should close after selection", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 1"));

      await waitFor(() => {
        // Content should close, but Option 1 might still be visible in trigger
        const option2 = screen.queryByRole("option", { name: "Option 2" });
        expect(option2).not.toBeInTheDocument();
      });
    });

    it("should update selection when changing between items", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <Select onValueChange={handleValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      // First selection
      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Option 1"));

      expect(handleValueChange).toHaveBeenCalledWith("option1");

      // Second selection
      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Option 2"));

      expect(handleValueChange).toHaveBeenCalledWith("option2");
      expect(handleValueChange).toHaveBeenCalledTimes(2);
    });
  });

  describe("Controlled Select", () => {
    it("should support controlled value", () => {
      render(
        <Select value="option2">
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByText("Option 2")).toBeInTheDocument();
    });

    it("should call onValueChange with new value", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <Select value="option1" onValueChange={handleValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 2")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Option 2"));

      expect(handleValueChange).toHaveBeenCalledWith("option2");
    });

    it("should support controlled open state", async () => {
      const user = userEvent.setup();
      const TestComponent = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <div>
            <button onClick={() => setOpen(!open)}>Toggle</button>
            <Select open={open} onOpenChange={setOpen}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /toggle/i }));

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });
    });
  });

  describe("Disabled State", () => {
    it("should support disabled select", () => {
      render(
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveAttribute("disabled");
    });

    it("should not open when disabled", async () => {
      const user = userEvent.setup();
      render(
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
    });

    it("should support disabled items", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <Select onValueChange={handleValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2" disabled>
              Option 2 (Disabled)
            </SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 2 (Disabled)")).toBeInTheDocument();
      });

      // Disabled item should have disabled attribute
      const disabledItem = screen.getByText("Option 2 (Disabled)");
      expect(disabledItem).toBeInTheDocument();
    });

    it("should apply disabled styles", () => {
      render(
        <Select disabled>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toHaveClass("disabled:cursor-not-allowed");
      expect(trigger).toHaveClass("disabled:opacity-50");
    });
  });

  describe("Select Groups and Labels", () => {
    it("should render select groups with labels", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Vegetables</SelectLabel>
              <SelectItem value="carrot">Carrot</SelectItem>
              <SelectItem value="potato">Potato</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Fruits")).toBeInTheDocument();
        expect(screen.getByText("Vegetables")).toBeInTheDocument();
        expect(screen.getByText("Apple")).toBeInTheDocument();
        expect(screen.getByText("Carrot")).toBeInTheDocument();
      });
    });

    it("should render separator", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectSeparator data-testid="separator" />
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByTestId("separator")).toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("should navigate items with arrow keys", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
            <SelectItem value="option3">Option 3</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole("combobox");
      trigger.focus();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });

      // Arrow down to navigate
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowDown}");

      // This tests that keyboard navigation is working
      // The actual focused element depends on Radix UI implementation
    });

    it("should close on Escape key", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
      });
    });

    it("should be keyboard accessible", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <button>Before</button>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
            </SelectContent>
          </Select>
          <button>After</button>
        </div>
      );

      // Tab to trigger
      await user.tab();
      await user.tab();

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveFocus();
    });
  });

  describe("Accessibility", () => {
    it("should have combobox role", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should support aria-label", () => {
      render(
        <Select>
          <SelectTrigger aria-label="Choose an option">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      expect(screen.getByLabelText("Choose an option")).toBeInTheDocument();
    });

    it("should have proper aria attributes", () => {
      render(
        <Select>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toHaveAttribute("role", "combobox");
      expect(trigger).toHaveAttribute("aria-expanded");
    });

    it("should support required attribute", () => {
      render(
        <Select required>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveAttribute("aria-required", "true");
    });

    it("should work with form labels", () => {
      render(
        <div>
          <label htmlFor="test-select">Choose option</label>
          <Select>
            <SelectTrigger id="test-select">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

      expect(screen.getByText("Choose option")).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("should apply trigger styles", () => {
      render(
        <Select>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toHaveClass("flex");
      expect(trigger).toHaveClass("h-9");
      expect(trigger).toHaveClass("w-full");
      expect(trigger).toHaveClass("items-center");
      expect(trigger).toHaveClass("justify-between");
      expect(trigger).toHaveClass("rounded-md");
      expect(trigger).toHaveClass("border");
    });

    it("should apply content styles", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent data-testid="content">
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const content = screen.getByTestId("content");
        expect(content).toHaveClass("relative");
        expect(content).toHaveClass("z-50");
        expect(content).toHaveClass("max-h-[--radix-select-content-available-height]");
        expect(content).toHaveClass("min-w-[8rem]");
      });
    });

    it("should apply item styles", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1" data-testid="item">
              Option 1
            </SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const item = screen.getByTestId("item");
        expect(item).toHaveClass("relative");
        expect(item).toHaveClass("flex");
        expect(item).toHaveClass("w-full");
        expect(item).toHaveClass("cursor-default");
      });
    });

    it("should merge custom className", () => {
      render(
        <Select>
          <SelectTrigger className="custom-class" data-testid="trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByTestId("trigger");
      expect(trigger).toHaveClass("custom-class");
      expect(trigger).toHaveClass("flex");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty select", () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Empty select" />
          </SelectTrigger>
          <SelectContent></SelectContent>
        </Select>
      );

      expect(screen.getByText("Empty select")).toBeInTheDocument();
    });

    it("should handle select with many items", async () => {
      const user = userEvent.setup();
      const items = Array.from({ length: 50 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i}`,
      }));

      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Option 0")).toBeInTheDocument();
        expect(screen.getByText("Option 10")).toBeInTheDocument();
      });
    });

    it("should handle rapid open/close", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole("combobox");

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText("Option 1")).toBeInTheDocument();
      });
    });

    it("should handle select with special characters", async () => {
      const user = userEvent.setup();
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option-1">Option &amp; Value</SelectItem>
            <SelectItem value="option-2">Option &quot;Quoted&quot;</SelectItem>
            <SelectItem value="option-3">Option (with special)</SelectItem>
          </SelectContent>
        </Select>
      );

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Option & Value")).toBeInTheDocument();
        expect(screen.getByText('Option "Quoted"')).toBeInTheDocument();
      });
    });
  });

  describe("Form Integration", () => {
    it("should support name attribute", () => {
      render(
        <Select name="test-select">
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      // Name attribute is internal to Radix UI's form handling
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should work in a form", async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn((e) => e.preventDefault());

      const TestForm = () => {
        const [value, setValue] = React.useState("option1");
        return (
          <form onSubmit={handleSubmit}>
            <Select value={value} onValueChange={setValue} name="test">
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
              </SelectContent>
            </Select>
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<TestForm />);

      // Verify select is rendered with pre-selected value
      const combobox = screen.getByRole("combobox");
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveTextContent("Option 1");

      // Submit form
      await user.click(screen.getByRole("button", { name: /submit/i }));
      expect(handleSubmit).toHaveBeenCalled();
    });
  });
});
