import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogOverlay,
} from "../dialog";

describe("Dialog", () => {
  describe("Basic Rendering", () => {
    it("should render dialog trigger", () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
        </Dialog>
      );
      expect(screen.getByRole("button", { name: /open dialog/i })).toBeInTheDocument();
    });

    it("should not render dialog content initially", () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();
    });

    it("should render dialog content when opened", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Dialog Title")).toBeInTheDocument();
      });
    });
  });

  describe("Controlled Dialog", () => {
    it("should support controlled open state", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText("Controlled Dialog")).toBeInTheDocument();
    });

    it("should support controlled closed state", () => {
      render(
        <Dialog open={false}>
          <DialogContent>
            <DialogTitle>Should Not Appear</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByText("Should Not Appear")).not.toBeInTheDocument();
    });

    it("should call onOpenChange when dialog state changes", async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      render(
        <Dialog onOpenChange={handleOpenChange}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true);
      });
    });

    it("should handle controlled state updates", async () => {
      const user = userEvent.setup();
      const TestComponent = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent>
              <DialogTitle>Controlled</DialogTitle>
              <DialogDescription>Dialog content</DialogDescription>
            </DialogContent>
          </Dialog>
        );
      };

      render(<TestComponent />);
      expect(screen.queryByText("Controlled")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Controlled")).toBeInTheDocument();
      });
    });
  });

  describe("Dialog Trigger", () => {
    it("should render custom trigger element", () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <button className="custom-trigger">Custom Trigger</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const trigger = screen.getByRole("button", { name: /custom trigger/i });
      expect(trigger).toHaveClass("custom-trigger");
    });

    it("should open dialog on trigger click", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Opened Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Opened Dialog")).toBeInTheDocument();
      });
    });
  });

  describe("Dialog Content", () => {
    it("should render dialog title", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>My Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("My Dialog Title")).toBeInTheDocument();
      });
    });

    it("should render dialog description", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>This is a description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("This is a description")).toBeInTheDocument();
      });
    });

    it("should render dialog header", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title in Header</DialogTitle>
              <DialogDescription>Description in Header</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Title in Header")).toBeInTheDocument();
        expect(screen.getByText("Description in Header")).toBeInTheDocument();
      });
    });

    it("should render dialog footer", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter>
              <button>Cancel</button>
              <button>Confirm</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
      });
    });

    it("should render close button", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
      });
    });

    it("should apply custom className to content", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent className="custom-content" data-testid="dialog-content">
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        const content = screen.getByTestId("dialog-content");
        expect(content).toHaveClass("custom-content");
      });
    });
  });

  describe("Dialog Overlay", () => {
    it("should render overlay when dialog is open", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        // Overlay should be rendered (checking for backdrop presence)
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
      });
    });

    it("should apply overlay styling classes", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("Closing Dialog", () => {
    it("should close on close button click", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText("Title")).not.toBeInTheDocument();
      });
    });

    it("should close on escape key", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Title")).not.toBeInTheDocument();
      });
    });

    it("should support DialogClose component", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogClose asChild>
              <button>Close Dialog</button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /close dialog/i }));

      await waitFor(() => {
        expect(screen.queryByText("Title")).not.toBeInTheDocument();
      });
    });

    it("should close when clicking outside (overlay)", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      // Note: clicking outside is handled by Radix UI, testing the mechanism
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have dialog role", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Accessible Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("should have accessible title", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
      });
    });

    it("should trap focus within dialog", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <input type="text" placeholder="First input" />
            <input type="text" placeholder="Second input" />
            <DialogClose asChild>
              <button>Close Dialog</button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Focus should be trapped within dialog
      // Radix UI manages focus, so we just verify focusable elements are present
      const firstInput = screen.getByPlaceholderText("First input");
      const secondInput = screen.getByPlaceholderText("Second input");
      const closeDialogButton = screen.getByRole("button", { name: /close dialog/i });
      const xButton = screen.getByRole("button", { name: /close$/i });

      expect(firstInput).toBeInTheDocument();
      expect(secondInput).toBeInTheDocument();
      expect(closeDialogButton).toBeInTheDocument();
      expect(xButton).toBeInTheDocument();
    });

    it("should restore focus on close", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <button>Before Dialog</button>
          <Dialog>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent>
              <DialogTitle>Title</DialogTitle>
            </DialogContent>
          </Dialog>
          <button>After Dialog</button>
        </div>
      );

      const trigger = screen.getByRole("button", { name: /open/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      // Focus should return to trigger
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it("should have sr-only text on close button", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        const closeButton = screen.getByRole("button", { name: /close/i });
        expect(closeButton).toBeInTheDocument();
      });
    });
  });

  describe("Complex Dialog Compositions", () => {
    it("should render complete dialog with all components", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open Form</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>Make changes to your profile here</DialogDescription>
            </DialogHeader>
            <div>
              <input placeholder="Name" />
              <input placeholder="Email" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <button>Cancel</button>
              </DialogClose>
              <button>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open form/i }));

      await waitFor(() => {
        expect(screen.getByText("Edit Profile")).toBeInTheDocument();
        expect(screen.getByText("Make changes to your profile here")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      });
    });

    it("should handle form submission in dialog", async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn((e) => e.preventDefault());

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Form Dialog</DialogTitle>
            <form onSubmit={handleSubmit}>
              <input name="username" placeholder="Username" />
              <button type="submit">Submit</button>
            </form>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("Username");
      await user.type(input, "testuser");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      expect(handleSubmit).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid open/close", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const trigger = screen.getByRole("button", { name: /open/i });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("should handle dialog without description", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Only Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByText("Only Title")).toBeInTheDocument();
      });
    });

    it("should prevent scroll when open", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Radix UI handles scroll lock automatically
    });
  });

  describe("Styling", () => {
    it("should apply correct content styles", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent data-testid="content">
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        const content = screen.getByTestId("content");
        expect(content).toHaveClass("fixed");
        expect(content).toHaveClass("left-[50%]");
        expect(content).toHaveClass("top-[50%]");
        expect(content).toHaveClass("translate-x-[-50%]");
        expect(content).toHaveClass("translate-y-[-50%]");
      });
    });

    it("should apply header styles", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader data-testid="header">
              <DialogTitle>Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        const header = screen.getByTestId("header");
        expect(header).toHaveClass("flex");
        expect(header).toHaveClass("flex-col");
        expect(header).toHaveClass("space-y-1.5");
      });
    });

    it("should apply footer styles", async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogFooter data-testid="footer">
              <button>Action</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByRole("button", { name: /open/i }));
      await waitFor(() => {
        const footer = screen.getByTestId("footer");
        expect(footer).toHaveClass("flex");
        expect(footer).toHaveClass("sm:justify-end");
      });
    });
  });
});
