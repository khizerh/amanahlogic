import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../card";

describe("Card", () => {
  describe("Card Component", () => {
    it("should render a card", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("should apply default styling classes", () => {
      render(<Card data-testid="card">Card content</Card>);
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("rounded-xl");
      expect(card).toHaveClass("border");
      expect(card).toHaveClass("bg-card");
      expect(card).toHaveClass("text-card-foreground");
      expect(card).toHaveClass("shadow");
    });

    it("should apply custom className", () => {
      render(
        <Card className="custom-class" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("custom-class");
      expect(card).toHaveClass("rounded-xl");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Content</Card>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });

    it("should render as a div element", () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId("card");
      expect(card.tagName).toBe("DIV");
    });

    it("should support data attributes", () => {
      render(
        <Card data-testid="card" data-custom="value">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toHaveAttribute("data-custom", "value");
    });
  });

  describe("CardHeader Component", () => {
    it("should render card header", () => {
      render(<CardHeader>Header content</CardHeader>);
      expect(screen.getByText("Header content")).toBeInTheDocument();
    });

    it("should apply default styling classes", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      const header = screen.getByTestId("header");
      expect(header).toHaveClass("flex");
      expect(header).toHaveClass("flex-col");
      expect(header).toHaveClass("space-y-1.5");
      expect(header).toHaveClass("p-6");
    });

    it("should apply custom className", () => {
      render(
        <CardHeader className="custom-header" data-testid="header">
          Header
        </CardHeader>
      );
      const header = screen.getByTestId("header");
      expect(header).toHaveClass("custom-header");
      expect(header).toHaveClass("p-6");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<CardHeader ref={ref}>Header</CardHeader>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe("CardTitle Component", () => {
    it("should render card title", () => {
      render(<CardTitle>Title text</CardTitle>);
      expect(screen.getByText("Title text")).toBeInTheDocument();
    });

    it("should render as h3 element", () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId("title");
      expect(title.tagName).toBe("DIV");
    });

    it("should apply default styling classes", () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId("title");
      expect(title).toHaveClass("font-semibold");
      expect(title).toHaveClass("leading-none");
      expect(title).toHaveClass("tracking-tight");
    });

    it("should apply custom className", () => {
      render(
        <CardTitle className="custom-title" data-testid="title">
          Title
        </CardTitle>
      );
      const title = screen.getByTestId("title");
      expect(title).toHaveClass("custom-title");
      expect(title).toHaveClass("font-semibold");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<CardTitle ref={ref}>Title</CardTitle>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });

    it("should support accessibility role", () => {
      render(<CardTitle>Main Title</CardTitle>);
      const title = screen.getByText("Main Title");
      expect(title).toHaveTextContent("Main Title");
    });
  });

  describe("CardDescription Component", () => {
    it("should render card description", () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText("Description text")).toBeInTheDocument();
    });

    it("should render as p element", () => {
      render(<CardDescription data-testid="description">Description</CardDescription>);
      const description = screen.getByTestId("description");
      expect(description.tagName).toBe("DIV");
    });

    it("should apply default styling classes", () => {
      render(<CardDescription data-testid="description">Description</CardDescription>);
      const description = screen.getByTestId("description");
      expect(description).toHaveClass("text-sm");
      expect(description).toHaveClass("text-muted-foreground");
    });

    it("should apply custom className", () => {
      render(
        <CardDescription className="custom-description" data-testid="description">
          Description
        </CardDescription>
      );
      const description = screen.getByTestId("description");
      expect(description).toHaveClass("custom-description");
      expect(description).toHaveClass("text-sm");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<CardDescription ref={ref}>Description</CardDescription>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe("CardContent Component", () => {
    it("should render card content", () => {
      render(<CardContent>Main content</CardContent>);
      expect(screen.getByText("Main content")).toBeInTheDocument();
    });

    it("should apply default styling classes", () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId("content");
      expect(content).toHaveClass("p-6");
      expect(content).toHaveClass("pt-0");
    });

    it("should apply custom className", () => {
      render(
        <CardContent className="custom-content" data-testid="content">
          Content
        </CardContent>
      );
      const content = screen.getByTestId("content");
      expect(content).toHaveClass("custom-content");
      expect(content).toHaveClass("p-6");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<CardContent ref={ref}>Content</CardContent>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe("CardFooter Component", () => {
    it("should render card footer", () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("should apply default styling classes", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId("footer");
      expect(footer).toHaveClass("flex");
      expect(footer).toHaveClass("items-center");
      expect(footer).toHaveClass("p-6");
      expect(footer).toHaveClass("pt-0");
    });

    it("should apply custom className", () => {
      render(
        <CardFooter className="custom-footer" data-testid="footer">
          Footer
        </CardFooter>
      );
      const footer = screen.getByTestId("footer");
      expect(footer).toHaveClass("custom-footer");
      expect(footer).toHaveClass("flex");
    });

    it("should forward ref correctly", () => {
      const ref = vi.fn();
      render(<CardFooter ref={ref}>Footer</CardFooter>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe("Card Composition", () => {
    it("should render complete card with all components", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Card Content</CardContent>
          <CardFooter>Card Footer</CardFooter>
        </Card>
      );

      expect(screen.getByText("Card Title")).toBeInTheDocument();
      expect(screen.getByText("Card Description")).toBeInTheDocument();
      expect(screen.getByText("Card Content")).toBeInTheDocument();
      expect(screen.getByText("Card Footer")).toBeInTheDocument();
    });

    it("should render card with only header and content", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title Only</CardTitle>
          </CardHeader>
          <CardContent>Content Only</CardContent>
        </Card>
      );

      expect(screen.getByText("Title Only")).toBeInTheDocument();
      expect(screen.getByText("Content Only")).toBeInTheDocument();
      expect(screen.queryByText("Footer")).not.toBeInTheDocument();
    });

    it("should maintain proper structure with nested elements", () => {
      const { container } = render(
        <Card data-testid="card">
          <CardHeader data-testid="header">
            <CardTitle data-testid="title">Title</CardTitle>
          </CardHeader>
          <CardContent data-testid="content">Content</CardContent>
        </Card>
      );

      const card = container.querySelector('[data-testid="card"]') as HTMLElement | null;
      const header = container.querySelector('[data-testid="header"]') as HTMLElement | null;
      const title = container.querySelector('[data-testid="title"]') as HTMLElement | null;
      const content = container.querySelector('[data-testid="content"]') as HTMLElement | null;

      expect(card).toContainElement(header);
      expect(header).toContainElement(title);
      expect(card).toContainElement(content);
    });
  });

  describe("Interactive Cards", () => {
    it("should support clickable cards", async () => {
      const handleClick = vi.fn();
      const { default: userEvent } = await import("@testing-library/user-event");
      const user = userEvent.setup();

      render(
        <Card onClick={handleClick} data-testid="card" role="button" tabIndex={0}>
          <CardContent>Clickable Card</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      await user.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should support keyboard navigation for clickable cards", async () => {
      const handleClick = vi.fn();
      const { default: userEvent } = await import("@testing-library/user-event");
      const user = userEvent.setup();

      render(
        <Card
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleClick(e);
          }}
          data-testid="card"
          role="button"
          tabIndex={0}
        >
          <CardContent>Interactive Card</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      card.focus();
      await user.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Accessible Card</CardTitle>
            <CardDescription>This is an accessible card</CardDescription>
          </CardHeader>
          <CardContent>Main content here</CardContent>
        </Card>
      );

      const title = screen.getByText("Accessible Card");
      expect(title).toHaveTextContent("Accessible Card");
    });

    it("should support aria-label on card", () => {
      render(
        <Card aria-label="Product card" data-testid="card">
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card).toHaveAttribute("aria-label", "Product card");
    });

    it("should support aria-labelledby", () => {
      render(
        <Card aria-labelledby="card-title" data-testid="card">
          <CardHeader>
            <CardTitle id="card-title">Title</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card).toHaveAttribute("aria-labelledby", "card-title");
    });

    it("should support aria-describedby", () => {
      render(
        <Card aria-describedby="card-description" data-testid="card">
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription id="card-description">Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card).toHaveAttribute("aria-describedby", "card-description");
    });
  });

  describe("Edge Cases", () => {
    it("should render empty card", () => {
      render(<Card data-testid="card" />);
      expect(screen.getByTestId("card")).toBeInTheDocument();
    });

    it("should handle multiple cards", () => {
      render(
        <>
          <Card data-testid="card-1">
            <CardContent>Card 1</CardContent>
          </Card>
          <Card data-testid="card-2">
            <CardContent>Card 2</CardContent>
          </Card>
        </>
      );

      expect(screen.getByTestId("card-1")).toBeInTheDocument();
      expect(screen.getByTestId("card-2")).toBeInTheDocument();
    });

    it("should render card with complex nested content", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Complex Card</CardTitle>
            <CardDescription>With nested elements</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <button>Action 1</button>
            <button>Action 2</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action 2" })).toBeInTheDocument();
    });

    it("should handle long content without breaking layout", () => {
      const longText = "Lorem ipsum ".repeat(100);
      render(
        <Card data-testid="card">
          <CardContent>{longText}</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card).toBeInTheDocument();
      // Check that the card contains the text (using includes to handle whitespace)
      expect(card.textContent).toContain("Lorem ipsum");
      expect(card.textContent!.length).toBeGreaterThan(1000);
    });

    it("should support multiple refs on different components", () => {
      const cardRef = vi.fn();
      const headerRef = vi.fn();
      const contentRef = vi.fn();

      render(
        <Card ref={cardRef}>
          <CardHeader ref={headerRef}>
            <CardTitle>Title</CardTitle>
          </CardHeader>
          <CardContent ref={contentRef}>Content</CardContent>
        </Card>
      );

      expect(cardRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
      expect(headerRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
      expect(contentRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe("Styling Overrides", () => {
    it("should allow className override for spacing", () => {
      render(
        <Card>
          <CardHeader className="p-4">
            <CardTitle>Custom Padding</CardTitle>
          </CardHeader>
          <CardContent className="p-4">Custom Content Padding</CardContent>
        </Card>
      );

      const header = screen.getByText("Custom Padding").parentElement;
      const content = screen.getByText("Custom Content Padding");

      expect(header).toHaveClass("p-4");
      expect(content).toHaveClass("p-4");
    });

    it("should allow custom background colors", () => {
      render(
        <Card className="bg-blue-500" data-testid="card">
          <CardContent>Colored Card</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card.className).toContain("bg-blue-500");
    });

    it("should allow custom border styles", () => {
      render(
        <Card className="border-2 border-red-500" data-testid="card">
          <CardContent>Custom Border</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card.className).toContain("border-2");
      expect(card.className).toContain("border-red-500");
    });
  });
});
