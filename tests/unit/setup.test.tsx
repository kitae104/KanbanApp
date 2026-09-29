import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("테스트 환경이 동작한다", () => {
  expect(1).toBe(1);
  render(<p>안녕</p>);
  expect(screen.getByText("안녕")).toBeInTheDocument();
});
