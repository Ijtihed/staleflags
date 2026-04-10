def billing
  if ENV["FEATURE_NEW_BILLING"] == "true"
    new_billing
  else
    old_billing
  end
end
