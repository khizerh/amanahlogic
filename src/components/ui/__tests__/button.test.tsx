import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../button";

describe("Button", () => {
  describe("Rendering", () => {
    it("should render with children", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("should render as a button element by default", () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole("button");
      expect(button.tagName).toBe("BUTTON");
    });

    it("should apply custom className", () => {
      render(<Button className="custom-class">Click me</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Click me</Button>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });

  describe("Variants", () => {
    it("should render default variant", () => {
      render(<Button variant="default">Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-primary");
      expect(button).toHaveClass("text-primary-foreground");
    });

    it("should render destructive variant", () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive");
      expect(button).toHaveClass("text-destructive-foreground");
    });

    it("should render outline variant", () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("border");
      expect(button).toHaveClass("border-input");
      expect(button).toHaveClass("bg-background");
    });

    it("should render secondary variant", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-secondary");
      expect(button).toHaveClass("text-secondary-foreground");
    });

    it("should render ghost variant", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-accent");
      expect(button).toHaveClass("hover:text-accent-foreground");
    });

    it("should render link variant", () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-primary");
      expect(button).toHaveClass("underline-offset-4");
    });
  });

  describe("Sizes", () => {
    it("should render default size", () => {
      render(<Button size="default">Default Size</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9");
      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("py-2");
    });

    it("should render small size", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-8");
      expect(button).toHaveClass("px-3");
      expect(button).toHaveClass("text-xs");
    });

    it("should render large size", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10");
      expect(button).toHaveClass("px-8");
    });

    it("should render icon size", () => {
      render(
        <Button size="icon" aria-label="Icon button">
          X
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9");
      expect(button).toHaveClass("w-9");
    });
  });

  describe("asChild Prop", () => {
    it("should render as child component when asChild is true", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      const link = screen.getByRole("link", { name: /link button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });

    it("should apply button styles to child component", () => {
      render(
        <Button asChild variant="destructive">
          <a href="/test">Delete Link</a>
        </Button>
      );
      const link = screen.getByRole("link");
      expect(link).toHaveClass("bg-destructive");
      expect(link).toHaveClass("text-destructive-foreground");
    });
  });

  describe("States", () => {
    it("should render disabled state", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("disabled:pointer-events-none");
      expect(button).toHaveClass("disabled:opacity-50");
    });

    it("should not trigger onClick when disabled", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const button = screen.getByRole("button");
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("should have focus-visible styles", () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus-visible:outline-none");
      expect(button).toHaveClass("focus-visible:ring-1");
      expect(button).toHaveClass("focus-visible:ring-ring");
    });
  });

  describe("Interactions", () => {
    it("should handle click events", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole("button");
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple clicks", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button);
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it("should handle keyboard events", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should handle Space key", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{ }");
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should have button role", () => {
      render(<Button>Accessible</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should support aria-label", () => {
      render(<Button aria-label="Close dialog">X</Button>);
      expect(screen.getByRole("button", { name: /close dialog/i })).toBeInTheDocument();
    });

    it("should support aria-describedby", () => {
      render(
        <>
          <Button aria-describedby="button-description">Action</Button>
          <div id="button-description">This performs an action</div>
        </>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-describedby", "button-description");
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <Button>First</Button>
          <Button>Second</Button>
        </div>
      );
      await user.tab();
      expect(screen.getByRole("button", { name: /first/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: /second/i })).toHaveFocus();
    });

    it("should indicate disabled state to screen readers", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("disabled");
    });
  });

  describe("HTML Attributes", () => {
    it("should support type attribute", () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
    });

    it("should support form attribute", () => {
      render(<Button form="my-form">Submit</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("form", "my-form");
    });

    it("should support data attributes", () => {
      render(
        <Button data-testid="custom-button" data-value="123">
          Test
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-testid", "custom-button");
      expect(button).toHaveAttribute("data-value", "123");
    });

    it("should support id attribute", () => {
      render(<Button id="unique-button">Test</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("id", "unique-button");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty children", () => {
      render(<Button></Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should handle multiple variants and sizes together", () => {
      render(
        <Button variant="destructive" size="lg">
          Delete
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive");
      expect(button).toHaveClass("h-10");
      expect(button).toHaveClass("px-8");
    });

    it("should handle JSX children", () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("IconText");
    });

    it("should preserve all HTML button attributes", () => {
      render(
        <Button name="action-button" value="submit-action" autoFocus>
          Test
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("name", "action-button");
      expect(button).toHaveAttribute("value", "submit-action");
      expect(button).toHaveFocus();
    });
  });

  describe("Style Classes", () => {
    it("should have base classes", () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("inline-flex");
      expect(button).toHaveClass("items-center");
      expect(button).toHaveClass("justify-center");
      expect(button).toHaveClass("rounded-md");
      expect(button).toHaveClass("text-sm");
      expect(button).toHaveClass("font-medium");
    });

    it("should merge custom classes with variant classes", () => {
      render(
        <Button className="custom-spacing" variant="outline">
          Test
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-spacing");
      expect(button).toHaveClass("border");
      expect(button).toHaveClass("bg-background");
    });

    it("should support className override patterns", () => {
      render(<Button className="bg-red-500">Custom Color</Button>);
      const button = screen.getByRole("button");
      // Custom class should be present
      expect(button.className).toContain("bg-red-500");
    });
  });
});
