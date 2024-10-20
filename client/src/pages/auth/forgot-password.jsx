import CommonForm from "@/components/common/form";
import { useToast } from "@/components/ui/use-toast";
import { forgotPasswordFormControls } from "@/config";
import { ForgotPassword } from "@/store/auth-slice";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";

const initialState = {
  email: "",
};

function ForgotPassword() {
  const [formData, setFormData] = useState(initialState);
  const dispatch = useDispatch();
  const { toast } = useToast();
  const navigate = useNavigate()

  function onSubmit(event) {
    event.preventDefault();

    dispatch(ForgotPassword(formData)).then((data) => {
      if (data?.payload?.success) {
        toast({
          title: data?.payload?.message,
        });
        navigate("/auth/reset-password")
      } else {
        toast({
          title: data?.payload?.message,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Email of your account
        </h1>
      </div>
      <CommonForm
        formControls={forgotPasswordFormControls}
        buttonText={"Update"}
        formData={formData}
        setFormData={setFormData}
        onSubmit={onSubmit}
      />
    </div>
  );
}

export default ForgotPassword;
