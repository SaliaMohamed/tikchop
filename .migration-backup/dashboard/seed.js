const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Variables manquantes: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log("Ajout des donnees de test Tikchop...")

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .upsert({
      phone_number: "+221770000000",
      name: "Salia Boutique",
      slug: "salia",
    })
    .select()
    .single()

  if (sellerError) {
    console.error("Erreur vendeur:", sellerError)
    return
  }

  console.log("Vendeur pret:", seller.name)

  const products = [
    {
      seller_id: seller.id,
      name: "Robe Africaine Premium",
      price: 15000,
      stock_quantity: 10,
      image_url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
      description: "Belle robe africaine de qualite superieure",
    },
    {
      seller_id: seller.id,
      name: "Sac a Main Elegant",
      price: 8500,
      stock_quantity: 15,
      image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400",
      description: "Sac a main en cuir veritable",
    },
    {
      seller_id: seller.id,
      name: "Bijoux Traditionnels",
      price: 5000,
      stock_quantity: 20,
      image_url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400",
      description: "Bijoux faits main avec des perles",
    },
    {
      seller_id: seller.id,
      name: "Chaussures Tendance",
      price: 12000,
      stock_quantity: 8,
      image_url: "https://images.unsplash.com/photo-1543163521-1bcc8bd6a85f?w=400",
      description: "Chaussures confortables et stylees",
    },
  ]

  const { error: productsError } = await supabase.from("products").insert(products)

  if (productsError) {
    console.error("Erreur produits:", productsError)
    return
  }

  console.log("4 produits ajoutes avec succes.")
  console.log("Ouvre http://localhost:3000/salia")
}

seed()
