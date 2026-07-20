import { UpdatePasswordForm } from "@/components/update-password-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center section-title text-accent">Keplo</p>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
