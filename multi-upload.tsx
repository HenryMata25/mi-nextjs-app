"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Download, Grid, Loader, ImageIcon, Trash2, Info, Palette } from "lucide-react"

export default function PixelItMultiUpload() {
  const [images, setImages] = useState<File[]>([])
  const [pixelatedImages, setPixelatedImages] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreatingZip, setIsCreatingZip] = useState(false)
  const [scale, setScale] = useState(8)
  const [palette, setPalette] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("original")
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  // Crear URLs de vista previa para las imágenes originales
  useEffect(() => {
    // Limpiar URLs anteriores
    const urls = previewUrls.map((url) => URL.revokeObjectURL(url))

    // Crear nuevas URLs
    const newUrls = images.map((image) => URL.createObjectURL(image))
    setPreviewUrls(newUrls)

    // Limpiar al desmontar
    return () => {
      newUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [images])

  // Función para pixelar una imagen
  const pixelateImage = async (imageFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Crear canvas original y de salida
        const originalCanvas = document.createElement("canvas")
        const outputCanvas = document.createElement("canvas")
        const originalCtx = originalCanvas.getContext("2d")
        const outputCtx = outputCanvas.getContext("2d")

        if (!originalCtx || !outputCtx) {
          reject("No se pudo obtener el contexto del canvas")
          return
        }

        // Cargar la imagen
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          try {
            // Configurar dimensiones de los canvas
            originalCanvas.width = img.width
            originalCanvas.height = img.height
            outputCanvas.width = img.width
            outputCanvas.height = img.height

            // Dibujar imagen original
            originalCtx.drawImage(img, 0, 0)

            // Pixelar la imagen
            const scaleFactor = scale

            // Crear un canvas temporal para la versión reducida
            const tempCanvas = document.createElement("canvas")
            const tempCtx = tempCanvas.getContext("2d")

            if (!tempCtx) {
              reject("No se pudo obtener el contexto del canvas temporal")
              return
            }

            // Calcular dimensiones escaladas
            const scaledWidth = Math.max(1, Math.floor(img.width / scaleFactor))
            const scaledHeight = Math.max(1, Math.floor(img.height / scaleFactor))

            tempCanvas.width = scaledWidth
            tempCanvas.height = scaledHeight

            // Dibujar la imagen original a escala reducida
            tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

            // Aplicar paleta de colores si se proporciona
            if (palette) {
              const paletteColors = palette.split(",").map((color) => color.trim())
              if (paletteColors.length > 0) {
                const imageData = tempCtx.getImageData(0, 0, scaledWidth, scaledHeight)
                const data = imageData.data

                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i]
                  const g = data[i + 1]
                  const b = data[i + 2]

                  // Encontrar el color más cercano en la paleta
                  const closestColor = findClosestColor(r, g, b, paletteColors)

                  data[i] = closestColor.r
                  data[i + 1] = closestColor.g
                  data[i + 2] = closestColor.b
                }

                tempCtx.putImageData(imageData, 0, 0)
              }
            }

            // Dibujar la imagen reducida de vuelta al canvas de salida con el tamaño original
            outputCtx.imageSmoothingEnabled = false
            outputCtx.drawImage(tempCanvas, 0, 0, img.width, img.height)

            // Convertir el canvas a una URL de datos
            const dataUrl = outputCanvas.toDataURL("image/png")
            resolve(dataUrl)
          } catch (err) {
            reject(`Error al procesar la imagen: ${err}`)
          }
        }

        img.onerror = () => {
          reject("Error al cargar la imagen")
        }

        img.src = URL.createObjectURL(imageFile)
      } catch (err) {
        reject(`Error general: ${err}`)
      }
    })
  }

  // Función para encontrar el color más cercano en la paleta
  const findClosestColor = (r: number, g: number, b: number, palette: string[]) => {
    let closestColor = { r, g, b }
    let closestDistance = Number.MAX_VALUE

    for (const colorHex of palette) {
      const color = hexToRgb(colorHex)
      if (!color) continue

      const distance = Math.sqrt(Math.pow(color.r - r, 2) + Math.pow(color.g - g, 2) + Math.pow(color.b - b, 2))

      if (distance < closestDistance) {
        closestDistance = distance
        closestColor = color
      }
    }

    return closestColor
  }

  // Función para convertir hex a rgb
  const hexToRgb = (hex: string) => {
    // Asegurarse de que el hex comience con #
    const formattedHex = hex.startsWith("#") ? hex : `#${hex}`
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(formattedHex)

    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Convertir FileList a array y limitar a 50 archivos
      const fileArray = Array.from(e.target.files).slice(0, 50)
      setImages(fileArray)
      // Resetear imágenes pixeladas cuando se seleccionan nuevos archivos
      setPixelatedImages([])
      setError(null)
    }
  }

  const processImages = async () => {
    if (images.length === 0) return

    setIsProcessing(true)
    setError(null)
    const newPixelatedImages: string[] = []

    // Cambiar automáticamente a la pestaña de imágenes pixeladas
    setActiveTab("pixelated")

    try {
      // Procesar cada imagen
      for (let i = 0; i < images.length; i++) {
        try {
          const pixelatedImage = await pixelateImage(images[i])
          newPixelatedImages.push(pixelatedImage)
        } catch (err) {
          console.error(`Error al procesar la imagen ${i + 1}:`, err)
          // Agregar una imagen de error
          newPixelatedImages.push("")
        }
      }

      setPixelatedImages(newPixelatedImages)
    } catch (err) {
      console.error("Error al procesar las imágenes:", err)
      setError("Ocurrió un error al procesar las imágenes. Por favor, intenta de nuevo.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Función para descargar todas las imágenes en un ZIP
  const downloadAllAsZip = async () => {
    if (pixelatedImages.length === 0) return

    setIsCreatingZip(true)
    try {
      // Importar JSZip dinámicamente
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()

      // Añadir cada imagen al ZIP
      for (let i = 0; i < pixelatedImages.length; i++) {
        if (!pixelatedImages[i]) continue

        // Convertir data URL a blob
        const response = await fetch(pixelatedImages[i])
        const blob = await response.blob()

        // Generar nombre de archivo
        const fileName = images[i]?.name
          ? `pixelated-${images[i].name.replace(/\.[^/.]+$/, "")}.png`
          : `pixelated-image-${i + 1}.png`

        // Añadir al ZIP
        zip.file(fileName, blob)
      }

      // Generar el archivo ZIP
      const content = await zip.generateAsync({ type: "blob" })

      // Crear URL para descargar
      const zipUrl = URL.createObjectURL(content)

      // Crear enlace de descarga y hacer clic
      const link = document.createElement("a")
      link.href = zipUrl
      link.download = "pixelated-images.zip"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Liberar URL
      setTimeout(() => URL.revokeObjectURL(zipUrl), 100)
    } catch (err) {
      console.error("Error al crear el archivo ZIP:", err)
      setError("Ocurrió un error al crear el archivo ZIP. Por favor, intenta de nuevo.")
    } finally {
      setIsCreatingZip(false)
    }
  }

  // Ejemplos de paletas predefinidas
  const predefinedPalettes = [
    { name: "Gameboy", colors: "#0f380f,#306230,#8bac0f,#9bbc0f" },
    {
      name: "CGA",
      colors:
        "#000000,#0000aa,#00aa00,#00aaaa,#aa0000,#aa00aa,#aa5500,#aaaaaa,#555555,#5555ff,#55ff55,#55ffff,#ff5555,#ff55ff,#ffff55,#ffffff",
    },
    { name: "Pastel", colors: "#f1c0e8,#ffcfd2,#cfbaf0,#a3c4f3,#90dbf4,#8eecf5,#98f5e1,#b9fbc0" },
    { name: "Retro", colors: "#d00000,#ffba08,#3f88c5,#032b43,#136f63" },
    { name: "Neon", colors: "#ff00ff,#00ffff,#ff0000,#00ff00,#0000ff,#ffff00" },
  ]

  return (
    <div className="min-h-screen bg-black py-10 px-4">
      <Card className="w-full max-w-5xl mx-auto shadow-xl border-0 overflow-hidden bg-zinc-900 text-zinc-100">
        <CardHeader className="bg-gradient-to-r from-cyan-600 to-blue-800 text-white">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-6 w-6" />
            <CardTitle>Pixel CR</CardTitle>
          </div>
          <CardDescription className="text-zinc-200">
            Convierte hasta 50 imágenes en arte pixel simultáneamente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-8">
            {/* Selector de archivos con diseño mejorado */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="images" className="text-lg font-medium text-zinc-200">
                  Imágenes
                </Label>
                <Badge variant="outline" className="font-normal bg-zinc-800 text-zinc-300 border-zinc-700">
                  {images.length} {images.length === 1 ? "imagen" : "imágenes"}
                </Badge>
              </div>

              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-cyan-600 transition-colors cursor-pointer bg-zinc-800">
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="images" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="h-10 w-10 text-zinc-500" />
                    <p className="text-zinc-300 font-medium">Arrastra y suelta tus imágenes aquí</p>
                    <p className="text-zinc-500 text-sm">o haz clic para seleccionar (máximo 50)</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Controles con diseño mejorado */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="scale" className="text-base font-medium text-zinc-200">
                    Escala de pixelado
                  </Label>
                  <Badge variant="secondary" className="bg-zinc-800 text-cyan-400 border-zinc-700">
                    {scale}
                  </Badge>
                </div>
                <div className="px-1">
                  <Slider
                    id="scale"
                    min={1}
                    max={30}
                    step={1}
                    value={[scale]}
                    onValueChange={(value) => setScale(value[0])}
                    className="py-4"
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Detallado</span>
                  <span>Pixelado</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="palette" className="text-base font-medium text-zinc-200">
                    Paleta de colores
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-200">
                          <Info className="h-4 w-4" />
                          <span className="sr-only">Información sobre paletas</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-zinc-800 text-zinc-200 border-zinc-700">
                        <p className="max-w-xs">
                          Ingresa códigos hexadecimales separados por comas (ej: #ff0000,#00ff00,#0000ff) o selecciona
                          una paleta predefinida.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Palette className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="palette"
                      type="text"
                      placeholder="Ej: #ff0000,#00ff00,#0000ff"
                      value={palette}
                      onChange={(e) => setPalette(e.target.value)}
                      className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {predefinedPalettes.map((p) => (
                    <Button
                      key={p.name}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => setPalette(p.colors)}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={processImages}
              disabled={images.length === 0 || isProcessing}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white h-12 text-base"
            >
              {isProcessing ? (
                <>
                  <Loader className="mr-2 h-5 w-5 animate-spin" />
                  Procesando imágenes...
                </>
              ) : (
                <>
                  <Grid className="mr-2 h-5 w-5" />
                  Pixelar Imágenes
                </>
              )}
            </Button>
          </div>

          {images.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-800">
                <TabsTrigger
                  value="original"
                  className="data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-100 text-zinc-400"
                >
                  Imágenes Originales
                </TabsTrigger>
                <TabsTrigger
                  value="pixelated"
                  className="data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-100 text-zinc-400"
                >
                  Imágenes Pixeladas
                </TabsTrigger>
              </TabsList>
              <TabsContent value="original">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={`original-${index}`}
                      className="group relative border border-zinc-800 rounded-lg overflow-hidden bg-zinc-800 shadow-md hover:shadow-lg hover:border-zinc-700 transition-all"
                    >
                      <div className="aspect-square overflow-hidden bg-zinc-900 flex items-center justify-center">
                        <img
                          src={previewUrls[index] || "/placeholder.svg"}
                          alt={`Original ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="p-2 bg-zinc-800">
                        <p className="text-xs truncate text-zinc-400">{image.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="pixelated">
                {pixelatedImages.length > 0 && (
                  <div className="mb-6 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPixelatedImages([])}
                      className="flex items-center bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Limpiar resultados
                    </Button>
                    <Button
                      variant="default"
                      onClick={downloadAllAsZip}
                      disabled={isCreatingZip}
                      className="flex items-center bg-cyan-700 hover:bg-cyan-800 text-white"
                    >
                      {isCreatingZip ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Creando ZIP...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Descargar ZIP
                        </>
                      )}
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={`pixelated-${index}`}
                      className="group relative border border-zinc-800 rounded-lg overflow-hidden bg-zinc-800 shadow-md hover:shadow-lg hover:border-zinc-700 transition-all"
                    >
                      {isProcessing && pixelatedImages.length <= index ? (
                        <div className="aspect-square flex items-center justify-center bg-zinc-900">
                          <div className="flex flex-col items-center gap-2">
                            <Loader className="h-8 w-8 animate-spin text-cyan-500" />
                            <p className="text-xs text-zinc-500">Procesando...</p>
                          </div>
                        </div>
                      ) : pixelatedImages[index] ? (
                        <>
                          <div className="aspect-square overflow-hidden bg-zinc-900 flex items-center justify-center relative group">
                            <img
                              src={pixelatedImages[index] || "/placeholder.svg"}
                              alt={`Pixelado ${index + 1}`}
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                              <a
                                href={pixelatedImages[index]}
                                download={`pixelated-${image.name}`}
                                className="bg-cyan-700 text-white rounded-full p-2 transform scale-90 hover:scale-100 transition-transform"
                              >
                                <Download className="h-5 w-5" />
                              </a>
                            </div>
                          </div>
                          <div className="p-2 bg-zinc-800 flex justify-between items-center">
                            <p className="text-xs truncate text-zinc-400 flex-1">{image.name}</p>
                            <a
                              href={pixelatedImages[index]}
                              download={`pixelated-${image.name}`}
                              className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline ml-2"
                            >
                              Descargar
                            </a>
                          </div>
                        </>
                      ) : (
                        <div className="aspect-square flex items-center justify-center bg-zinc-900">
                          <p className="text-sm text-zinc-500">
                            {isProcessing ? <Loader className="h-6 w-6 animate-spin text-zinc-400" /> : "Sin procesar"}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="flex justify-between bg-zinc-900 border-t border-zinc-800 px-6 py-4">
          <p className="text-sm text-zinc-500">Hecho por Henry Mata</p>
        </CardFooter>
      </Card>
    </div>
  )
}
