import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProjectActionsMenu } from "./ProjectActionsMenu";

function renderMenu(onArchive = vi.fn()) {
  render(
    <MemoryRouter>
      <ProjectActionsMenu projectId={7} onArchive={onArchive} />
    </MemoryRouter>,
  );
  return onArchive;
}

describe("ProjectActionsMenu", () => {
  it("hides Edit and Archive until the trigger is opened", () => {
    renderMenu();

    expect(screen.queryByRole("menuitem", { name: "Edit Project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Archive Project" })).not.toBeInTheDocument();
  });

  it("shows Edit Project linking to the edit route and closes on selection", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "More Project actions" }));
    const editLink = screen.getByRole("menuitem", { name: "Edit Project" });
    expect(editLink).toHaveAttribute("href", "/app/projects/7/edit");

    await user.click(editLink);
    expect(screen.queryByRole("menuitem", { name: "Edit Project" })).not.toBeInTheDocument();
  });

  it("calls onArchive and closes when Archive Project is selected", async () => {
    const user = userEvent.setup();
    const onArchive = renderMenu();

    await user.click(screen.getByRole("button", { name: "More Project actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive Project" }));

    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "Archive Project" })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "More Project actions" }));
    expect(screen.getByRole("menuitem", { name: "Edit Project" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: "Edit Project" })).not.toBeInTheDocument();
  });
});
