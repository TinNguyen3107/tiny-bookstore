export function isValidUsername(username: string): boolean {
  // Username must be 3-20 characters long and contain only letters, numbers, and underscores
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

export function isValidPassword(password: string): boolean {
  // Password must be at least 6 characters long
  return password.length >= 6;
}

export function isValidFullName(fullName: string): boolean {
  // Full name must only contain letters and spaces (including unicode letters for Vietnamese)
  return /^[a-zA-ZÀ-ỹ\s]+$/.test(fullName) && fullName.trim().length > 0;
}

export function isValidEmail(email: string): boolean {
  // Basic email validation regex (require at least 2 chars for TLD)
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

export function validateRegistrationData(data: any): { isValid: boolean; error?: string } {
  if (!data.username || !isValidUsername(data.username)) {
    return { isValid: false, error: "Tên đăng nhập phải từ 3-20 ký tự, không chứa ký tự đặc biệt hoặc khoảng trắng." };
  }
  if (!data.password || !isValidPassword(data.password)) {
    return { isValid: false, error: "Mật khẩu phải chứa ít nhất 6 ký tự." };
  }
  if (data.fullName && !isValidFullName(data.fullName)) {
    return { isValid: false, error: "Họ tên không được chứa số hoặc ký tự đặc biệt." };
  }
  if (data.email && !isValidEmail(data.email)) {
    return { isValid: false, error: "Định dạng email không hợp lệ." };
  }
  return { isValid: true };
}

export function validateProfileUpdateData(data: any): { isValid: boolean; error?: string } {
  if (data.username && !isValidUsername(data.username)) {
    return { isValid: false, error: "Tên đăng nhập phải từ 3-20 ký tự, không chứa ký tự đặc biệt hoặc khoảng trắng." };
  }
  if (data.fullName && !isValidFullName(data.fullName)) {
    return { isValid: false, error: "Họ tên không được chứa số hoặc ký tự đặc biệt." };
  }
  if (data.email && !isValidEmail(data.email)) {
    return { isValid: false, error: "Định dạng email không hợp lệ." };
  }
  return { isValid: true };
}

export function validateBookData(data: any): { isValid: boolean; error?: string; value?: any } {
  const categoryId = data.categoryId ? Number(data.categoryId) : null;
  const bookCode = String(data.bookCode ?? "").trim() || null;
  const title = String(data.title ?? "").trim();
  const author = String(data.author ?? "").trim();
  const translator = String(data.translator ?? "").trim() || null;
  const publisher = String(data.publisher ?? "").trim() || null;
  const publishedYear = data.publishedYear ? Number(data.publishedYear) : null;
  const description = String(data.description ?? "").trim();
  const cover = String(data.cover ?? "").trim();
  const weight = data.weight ? Number(data.weight) : null;
  const dimensions = String(data.dimensions ?? "").trim() || null;
  const pages = data.pages ? Number(data.pages) : null;
  const format = String(data.format ?? "").trim() || null;
  const price = Number(data.price);
  const stock = Number(data.stock);

  if (!title) return { isValid: false, error: "Tên sách không được để trống." };
  if (!Number.isFinite(price) || price <= 0)
    return { isValid: false, error: "Giá sách phải là số hợp lệ và lớn hơn 0." };
  if (!Number.isInteger(stock) || stock < 0)
    return { isValid: false, error: "Số lượng tồn kho phải là số nguyên không âm." };
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0))
    return { isValid: false, error: "Mã danh mục không hợp lệ." };

  return {
    isValid: true,
    value: { categoryId, bookCode, title, author, translator, publisher, publishedYear, description, cover, price, stock, weight, dimensions, pages, format },
  };
}

export function validateCategoryData(data: any): { isValid: boolean; error?: string } {
  const name = String(data.name ?? "").trim();
  if (!name) return { isValid: false, error: "Tên danh mục không được để trống." };
  return { isValid: true };
}

export function validateOrderItems(items: any): { isValid: boolean; error?: string; quantities?: Map<number, number> } {
  const incomingItems = Array.isArray(items) ? items : [];
  if (incomingItems.length === 0) {
    return { isValid: false, error: "Giỏ hàng của bạn đang trống." };
  }

  const quantities = new Map<number, number>();
  for (const rawItem of incomingItems) {
    const bookId = Number(rawItem?.bookId);
    const quantity = Number(rawItem?.quantity);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      return { isValid: false, error: "Mã sách trong giỏ hàng không hợp lệ." };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { isValid: false, error: "Số lượng sách phải là số nguyên dương." };
    }
    quantities.set(bookId, (quantities.get(bookId) ?? 0) + quantity);
  }

  return { isValid: true, quantities };
}
